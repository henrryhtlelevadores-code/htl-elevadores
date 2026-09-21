import "server-only";
import { sql, eq, and, isNull, desc, asc } from "drizzle-orm";
import {
  db,
  costCenters,
  elevatorUnities,
  brands,
  models,
  elevatorTypes,
  workOrders,
  workOrderElevators,
  workOrderTasks,
  users,
  clients,
  serviceTypes,
} from "@/db/index";

export interface PortalLoginInfo {
  id: string;
  name: string;
  address: string | null;
  district: string | null;
  hasPassword: boolean;
}

export async function getPortalLoginInfo(
  costCenterId: string
): Promise<PortalLoginInfo | null> {
  const rows = await db
    .select({
      id: costCenters.id,
      name: costCenters.name,
      address: costCenters.address,
      district: costCenters.district,
      passwordHash: costCenters.passwordHash,
    })
    .from(costCenters)
    .where(and(eq(costCenters.id, costCenterId), isNull(costCenters.deletedAt)))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    district: row.district,
    hasPassword: Boolean(row.passwordHash),
  };
}

export interface PortalEquipmentItem {
  id: string;
  name: string;
  internalCode: string;
  brandName: string | null;
  modelName: string | null;
  elevatorTypeName: string | null;
  stops: number | null;
  floors: number | null;
  status: string | null;
}

export interface PortalWorkOrderItem {
  id: string;
  otNumber: string;
  type: string | null;
  status: string | null;
  priority: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  createdAt: number | null;
}

export interface PortalInformeItem {
  id: string;
  otNumber: string;
  type: string | null;
  serviceTypeName: string | null;
  completedAt: number | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  equipmentCount: number;
}

export interface PortalDashboardData {
  costCenter: {
    id: string;
    name: string;
    address: string | null;
    district: string | null;
    mainPhotoUrl: string | null;
  };
  equipments: PortalEquipmentItem[];
  recentWorkOrders: PortalWorkOrderItem[];
  informes: PortalInformeItem[];
}

export async function getPortalInformes(
  costCenterId: string
): Promise<PortalInformeItem[]> {
  try {
    const equipmentCount = sql<number>`(SELECT COUNT(*) FROM work_order_elevators woe WHERE woe.work_order_id = work_orders.id)`;

    return await db
      .select({
        id: workOrders.id,
        otNumber: workOrders.otNumber,
        type: workOrders.type,
        serviceTypeName: serviceTypes.name,
        completedAt: workOrders.completedAt,
        scheduledDate: workOrders.scheduledDate,
        scheduledTime: workOrders.scheduledTime,
        equipmentCount,
      })
      .from(workOrders)
      .leftJoin(serviceTypes, eq(workOrders.type, serviceTypes.id))
      .where(
        and(
          eq(workOrders.costCenterId, costCenterId),
          eq(workOrders.status, "COMPLETED"),
          isNull(workOrders.deletedAt)
        )
      )
      .orderBy(desc(workOrders.completedAt))
      .limit(20);
  } catch (error) {
    console.error("Error al obtener informes del portal:", error);
    return [];
  }
}

export async function getPortalDashboardData(
  costCenterId: string
): Promise<PortalDashboardData | null> {
  const ccRows = await db
    .select({
      id: costCenters.id,
      name: costCenters.name,
      address: costCenters.address,
      district: costCenters.district,
      mainPhotoUrl: costCenters.mainPhotoUrl,
    })
    .from(costCenters)
    .where(and(eq(costCenters.id, costCenterId), isNull(costCenters.deletedAt)))
    .limit(1);

  if (ccRows.length === 0) return null;
  const costCenter = ccRows[0];

  const [equipments, workOrderRows, informeRows] = await Promise.all([
    db
      .select({
        id: elevatorUnities.id,
        name: elevatorUnities.name,
        internalCode: elevatorUnities.internalCode,
        brandName: brands.name,
        modelName: models.name,
        elevatorTypeName: elevatorTypes.name,
        stops: elevatorUnities.stops,
        floors: elevatorUnities.floors,
        status: elevatorUnities.status,
      })
      .from(elevatorUnities)
      .leftJoin(brands, eq(elevatorUnities.brandId, brands.id))
      .leftJoin(models, eq(elevatorUnities.modelId, models.id))
      .innerJoin(elevatorTypes, eq(elevatorUnities.elevatorTypeId, elevatorTypes.id))
      .where(and(eq(elevatorUnities.costCenterId, costCenterId), isNull(elevatorUnities.deletedAt)))
      .orderBy(asc(elevatorUnities.internalCode)),

    db
      .select({
        id: workOrders.id,
        otNumber: workOrders.otNumber,
        type: workOrders.type,
        status: workOrders.status,
        priority: workOrders.priority,
        scheduledDate: workOrders.scheduledDate,
        scheduledTime: workOrders.scheduledTime,
        createdAt: workOrders.createdAt,
      })
      .from(workOrders)
      .where(and(eq(workOrders.costCenterId, costCenterId), isNull(workOrders.deletedAt)))
      .orderBy(desc(workOrders.createdAt))
      .limit(6),

    getPortalInformes(costCenterId),
  ]);

  return { costCenter, equipments, recentWorkOrders: workOrderRows, informes: informeRows };
}

export interface PortalDocumentTask {
  id: string;
  taskDescription: string;
  isCritical: boolean;
  isCompleted: boolean;
  observations: string | null;
}

export interface PortalDocumentElevator {
  id: string;
  internalCode: string | null;
  elevatorName: string | null;
  brandName: string | null;
  modelName: string | null;
  elevatorTypeName: string | null;
  finding: string | null;
  evidencePhotoUrls: string[];
  finalStatus: string | null;
  tasks: PortalDocumentTask[];
}

export interface PortalWorkOrderDocument {
  id: string;
  otNumber: string;
  type: string | null;
  status: string | null;
  priority: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  startedAt: number | null;
  completedAt: number | null;
  closingNotes: string | null;
  clientSignatureUrl: string | null;
  clientSignerName: string | null;
  clientName: string | null;
  costCenterName: string | null;
  costCenterAddress: string | null;
  costCenterDistrict: string | null;
  technicianName: string | null;
  serviceTypeName: string | null;
  elevators: PortalDocumentElevator[];
}

export async function getPortalWorkOrderDocument(
  costCenterId: string,
  workOrderId: string
): Promise<PortalWorkOrderDocument | null> {
  try {
    const woRows = await db
      .select({
        id: workOrders.id,
        otNumber: workOrders.otNumber,
        type: workOrders.type,
        status: workOrders.status,
        priority: workOrders.priority,
        scheduledDate: workOrders.scheduledDate,
        scheduledTime: workOrders.scheduledTime,
        startedAt: workOrders.startedAt,
        completedAt: workOrders.completedAt,
        closingNotes: workOrders.closingNotes,
        clientSignatureUrl: workOrders.clientSignatureUrl,
        clientSignerName: workOrders.clientSignerName,
        clientName: clients.legalName,
        costCenterName: costCenters.name,
        costCenterAddress: costCenters.address,
        costCenterDistrict: costCenters.district,
        technicianName: users.fullName,
        serviceTypeName: serviceTypes.name,
      })
      .from(workOrders)
      .innerJoin(costCenters, eq(workOrders.costCenterId, costCenters.id))
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .leftJoin(users, eq(workOrders.technicianId, users.id))
      .leftJoin(serviceTypes, eq(workOrders.type, serviceTypes.id))
      .where(
        and(
          eq(workOrders.id, workOrderId),
          eq(workOrders.costCenterId, costCenterId),
          eq(workOrders.status, "COMPLETED"),
          isNull(workOrders.deletedAt)
        )
      )
      .limit(1);

    const wo = woRows[0];
    if (!wo) return null;

    const elevatorRows = await db
      .select({
        id: workOrderElevators.id,
        workOrderId: workOrderElevators.workOrderId,
        internalCode: elevatorUnities.internalCode,
        elevatorName: elevatorUnities.name,
        brandName: brands.name,
        modelName: models.name,
        elevatorTypeName: elevatorTypes.name,
        finding: workOrderElevators.finding,
        evidencePhotoUrls: workOrderElevators.evidencePhotoUrls,
        finalStatus: workOrderElevators.finalStatus,
      })
      .from(workOrderElevators)
      .innerJoin(elevatorUnities, eq(workOrderElevators.elevatorUnityId, elevatorUnities.id))
      .leftJoin(brands, eq(elevatorUnities.brandId, brands.id))
      .leftJoin(models, eq(elevatorUnities.modelId, models.id))
      .leftJoin(elevatorTypes, eq(elevatorUnities.elevatorTypeId, elevatorTypes.id))
      .where(eq(workOrderElevators.workOrderId, workOrderId))
      .orderBy(asc(elevatorUnities.internalCode));

    const taskRows = await db
      .select({
        id: workOrderTasks.id,
        workOrderElevatorId: workOrderTasks.workOrderElevatorId,
        taskDescription: workOrderTasks.taskDescription,
        isCritical: workOrderTasks.isCritical,
        isCompleted: workOrderTasks.isCompleted,
        observations: workOrderTasks.observations,
      })
      .from(workOrderTasks)
      .orderBy(asc(workOrderTasks.id));

    const tasksByElevator = new Map<string, PortalDocumentTask[]>();
    for (const task of taskRows) {
      const list = tasksByElevator.get(task.workOrderElevatorId) ?? [];
      list.push({
        id: task.id,
        taskDescription: task.taskDescription,
        isCritical: !!task.isCritical,
        isCompleted: !!task.isCompleted,
        observations: task.observations,
      });
      tasksByElevator.set(task.workOrderElevatorId, list);
    }

    return {
      id: wo.id,
      otNumber: wo.otNumber,
      type: wo.type,
      status: wo.status,
      priority: wo.priority,
      scheduledDate: wo.scheduledDate,
      scheduledTime: wo.scheduledTime,
      startedAt: wo.startedAt,
      completedAt: wo.completedAt,
      closingNotes: wo.closingNotes,
      clientSignatureUrl: wo.clientSignatureUrl,
      clientSignerName: wo.clientSignerName,
      clientName: wo.clientName,
      costCenterName: wo.costCenterName,
      costCenterAddress: wo.costCenterAddress,
      costCenterDistrict: wo.costCenterDistrict,
      technicianName: wo.technicianName,
      serviceTypeName: wo.serviceTypeName,
      elevators: elevatorRows.map((e) => ({
        id: e.id,
        internalCode: e.internalCode,
        elevatorName: e.elevatorName,
        brandName: e.brandName,
        modelName: e.modelName,
        elevatorTypeName: e.elevatorTypeName,
        finding: e.finding,
        evidencePhotoUrls: (e.evidencePhotoUrls as string[] | null) ?? [],
        finalStatus: e.finalStatus,
        tasks: tasksByElevator.get(e.id) ?? [],
      })),
    };
  } catch (error) {
    console.error("Error al obtener documento de OT del portal:", error);
    return null;
  }
}