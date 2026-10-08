import "server-only";
import { sql, eq, and, or, isNull, desc, asc, inArray } from "drizzle-orm";
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
  workOrderElevatorPhotos,
  maintenanceModules,
  users,
  clients,
  serviceTypes,
  ubigeos,
  quotations,
  contracts,
} from "@/db/index";
import { portalContractPdfPath } from "@/lib/pdf-paths";

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
      district: ubigeos.distrito,
      passwordHash: costCenters.passwordHash,
    })
    .from(costCenters)
    .leftJoin(ubigeos, eq(costCenters.ubigeoId, ubigeos.id))
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
  lastVisitDate: number | null;
  nextVisitDate: number | null;
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
  completedAt: number | null;
  serviceTypeName: string | null;
  technicianName: string | null;
  equipmentCount: number;
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

export interface PortalQuotationItem {
  id: string;
  quotationNumber: string;
  issueDate: number | null;
  validUntil: number | null;
  status: string | null;
  total: number | null;
  lineCount: number;
}

export interface PortalEquipmentHistoryItem {
  id: string;
  workOrderElevatorId: string;
  otNumber: string;
  status: string | null;
  serviceTypeName: string | null;
  completedAt: number | null;
  scheduledDate: string | null;
  technicianName: string | null;
}

export async function getPortalEquipmentHistory(
  costCenterId: string,
  elevatorId: string
): Promise<{ equipment: PortalEquipmentItem | null; orders: PortalEquipmentHistoryItem[] }> {
  const [equipment] = await db
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
      lastVisitDate: sql<number | null>`NULL`,
      nextVisitDate: sql<number | null>`NULL`,
    })
    .from(elevatorUnities)
    .leftJoin(brands, eq(elevatorUnities.brandId, brands.id))
    .leftJoin(models, eq(elevatorUnities.modelId, models.id))
    .leftJoin(elevatorTypes, eq(elevatorUnities.elevatorTypeId, elevatorTypes.id))
    .where(and(eq(elevatorUnities.id, elevatorId), eq(elevatorUnities.costCenterId, costCenterId), isNull(elevatorUnities.deletedAt)))
    .limit(1);

  if (!equipment) return { equipment: null, orders: [] };

  const orders = await db
    .select({
      id: workOrders.id,
      workOrderElevatorId: workOrderElevators.id,
      otNumber: workOrders.otNumber,
      status: workOrders.status,
      serviceTypeName: serviceTypes.name,
      completedAt: workOrders.completedAt,
      scheduledDate: workOrders.scheduledDate,
      technicianName: users.fullName,
    })
    .from(workOrderElevators)
    .innerJoin(workOrders, eq(workOrderElevators.workOrderId, workOrders.id))
    .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
    .leftJoin(users, eq(workOrders.technicianId, users.id))
    .where(and(
      eq(workOrderElevators.elevatorUnityId, elevatorId),
      eq(workOrders.costCenterId, costCenterId),
      eq(workOrders.approvalStatus, "APPROVED"),
      isNull(workOrders.deletedAt)
    ))
    .orderBy(desc(workOrders.completedAt), desc(workOrders.createdAt));

  return { equipment, orders };
}

export interface PortalDashboardData {
  costCenter: {
    id: string;
    name: string;
    address: string | null;
    district: string | null;
    mainPhotoUrl: string | null;
    contactName: string | null;
    contactPhone: string | null;
  };
  equipments: PortalEquipmentItem[];
  recentWorkOrders: PortalWorkOrderItem[];
  informes: PortalInformeItem[];
  quotations: PortalQuotationItem[];
  documents: Array<{ id: string; name: string; url: string }>;
}

export async function getPortalQuotations(
  costCenterId: string
): Promise<PortalQuotationItem[]> {
  try {
    const lineCount = sql<number>`(SELECT COUNT(*) FROM quotation_lines ql WHERE ql.quotation_id = quotations.id)`;

    return await db
      .select({
        id: quotations.id,
        quotationNumber: quotations.quotationNumber,
        issueDate: quotations.issueDate,
        validUntil: quotations.validUntil,
        status: quotations.status,
        total: quotations.total,
        lineCount,
      })
      .from(quotations)
      .where(
        and(
          eq(quotations.costCenterId, costCenterId),
          or(eq(quotations.status, "SENT"), eq(quotations.status, "ACCEPTED"))
        )
      )
      .orderBy(desc(quotations.createdAt))
      .limit(20);
  } catch (error) {
    console.error("Error al obtener cotizaciones del portal:", error);
    return [];
  }
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
        type: workOrders.serviceTypeId,
        serviceTypeName: serviceTypes.name,
        completedAt: workOrders.completedAt,
        scheduledDate: workOrders.scheduledDate,
        scheduledTime: workOrders.scheduledTime,
        equipmentCount,
      })
      .from(workOrders)
      .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
      .where(
        and(
          eq(workOrders.costCenterId, costCenterId),
          eq(workOrders.status, "COMPLETED"),
          eq(workOrders.approvalStatus, "APPROVED"),
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
      district: ubigeos.distrito,
      mainPhotoUrl: costCenters.mainPhotoUrl,
      contactName: sql<string | null>`(SELECT ccc.full_name FROM cost_center_contacts ccc WHERE ccc.cost_center_id = ${costCenters.id} AND ccc.is_active = 1 ORDER BY ccc.full_name LIMIT 1)`,
      contactPhone: sql<string | null>`(SELECT ccc.phone FROM cost_center_contacts ccc WHERE ccc.cost_center_id = ${costCenters.id} AND ccc.is_active = 1 ORDER BY ccc.full_name LIMIT 1)`,
    })
    .from(costCenters)
    .leftJoin(ubigeos, eq(costCenters.ubigeoId, ubigeos.id))
    .where(and(eq(costCenters.id, costCenterId), isNull(costCenters.deletedAt)))
    .limit(1);

  if (ccRows.length === 0) return null;
  const costCenter = ccRows[0];

  const [equipments, workOrderRows, informeRows, quotationRows, documents] = await Promise.all([
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
        lastVisitDate: sql<number | null>`NULL`,
        nextVisitDate: sql<number | null>`NULL`,
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
        type: workOrders.serviceTypeId,
        status: workOrders.status,
        priority: workOrders.priority,
        scheduledDate: workOrders.scheduledDate,
        scheduledTime: workOrders.scheduledTime,
        createdAt: workOrders.createdAt,
        completedAt: workOrders.completedAt,
        serviceTypeName: serviceTypes.name,
        technicianName: users.fullName,
        equipmentCount: sql<number>`(SELECT COUNT(*) FROM work_order_elevators woe WHERE woe.work_order_id = work_orders.id)`,
      })
      .from(workOrders)
      .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
      .leftJoin(users, eq(workOrders.technicianId, users.id))
      .where(
        and(
          eq(workOrders.costCenterId, costCenterId),
          isNull(workOrders.deletedAt),
          eq(workOrders.approvalStatus, "APPROVED")
        )
      )
      .orderBy(desc(workOrders.createdAt))
       .limit(20),

    getPortalInformes(costCenterId),

    getPortalQuotations(costCenterId),

    db
      .select({
        id: contracts.id,
        name: contracts.contractNumber,
        finalPdfUrl: contracts.finalPdfUrl,
        finalPdfKey: contracts.finalPdfKey,
      })
      .from(contracts)
      .where(and(eq(contracts.costCenterId, costCenterId), isNull(contracts.deletedAt))),
  ]);

  return {
    costCenter,
    equipments,
    recentWorkOrders: workOrderRows,
    informes: informeRows,
    quotations: quotationRows,
    documents: documents.flatMap((document) =>
      // Ruta de la app que valida la sesión; nunca la URL del bucket.
      document.finalPdfKey || document.finalPdfUrl
        ? [
            {
              id: document.id,
              name: document.name,
              url: portalContractPdfPath(costCenterId, document.id),
            },
          ]
        : []
    ),
  };
}

export interface PortalDocumentTask {
  id: string;
  taskDescription: string;
  isCritical: boolean;
  isCompleted: boolean;
  observations: string | null;
  moduleId: string | null;
  moduleCode: string | null;
  moduleName: string | null;
}

export interface PortalDocumentPhoto {
  id: string;
  url: string;
  tag: string;
  description: string | null;
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
  photos: PortalDocumentPhoto[];
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
  workOrderId: string,
  elevatorId?: string
): Promise<PortalWorkOrderDocument | null> {
  try {
    const woRows = await db
      .select({
        id: workOrders.id,
        otNumber: workOrders.otNumber,
        type: workOrders.serviceTypeId,
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
        costCenterDistrict: ubigeos.distrito,
        technicianName: users.fullName,
        serviceTypeName: serviceTypes.name,
      })
      .from(workOrders)
      .innerJoin(costCenters, eq(workOrders.costCenterId, costCenters.id))
      .leftJoin(ubigeos, eq(costCenters.ubigeoId, ubigeos.id))
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .leftJoin(users, eq(workOrders.technicianId, users.id))
      .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
      .where(
        and(
          eq(workOrders.id, workOrderId),
          eq(workOrders.costCenterId, costCenterId),
          eq(workOrders.status, "COMPLETED"),
          eq(workOrders.approvalStatus, "APPROVED"),
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
      .where(
        elevatorId
          ? and(eq(workOrderElevators.workOrderId, workOrderId), eq(workOrderElevators.id, elevatorId))
          : eq(workOrderElevators.workOrderId, workOrderId)
      )
      .orderBy(asc(elevatorUnities.internalCode));

    const taskRows = await db
      .select({
        id: workOrderTasks.id,
        workOrderElevatorId: workOrderTasks.workOrderElevatorId,
        taskDescription: workOrderTasks.taskDescription,
        isCritical: workOrderTasks.isCritical,
        isCompleted: workOrderTasks.isCompleted,
        observations: workOrderTasks.observations,
        moduleId: workOrderTasks.moduleId,
        moduleCode: maintenanceModules.code,
        moduleName: maintenanceModules.name,
      })
      .from(workOrderTasks)
      .leftJoin(maintenanceModules, eq(workOrderTasks.moduleId, maintenanceModules.id))
      .orderBy(asc(workOrderTasks.id));

    const photoRows = await db
      .select({
        id: workOrderElevatorPhotos.id,
        workOrderElevatorId: workOrderElevatorPhotos.workOrderElevatorId,
        url: workOrderElevatorPhotos.url,
        tag: workOrderElevatorPhotos.tag,
        description: workOrderElevatorPhotos.description,
      })
      .from(workOrderElevatorPhotos)
      .where(
        elevatorRows.length > 0
          ? inArray(workOrderElevatorPhotos.workOrderElevatorId, elevatorRows.map((elevator) => elevator.id))
          : eq(workOrderElevatorPhotos.workOrderElevatorId, "__none__")
      );

    const photosByElevator = new Map<string, PortalDocumentPhoto[]>();
    for (const photo of photoRows) {
      const list = photosByElevator.get(photo.workOrderElevatorId) ?? [];
      list.push({
        id: photo.id,
        url: photo.url,
        tag: photo.tag,
        description: photo.description,
      });
      photosByElevator.set(photo.workOrderElevatorId, list);
    }

    const tasksByElevator = new Map<string, PortalDocumentTask[]>();
    for (const task of taskRows) {
      const list = tasksByElevator.get(task.workOrderElevatorId) ?? [];
      list.push({
        id: task.id,
        taskDescription: task.taskDescription,
        isCritical: !!task.isCritical,
        isCompleted: !!task.isCompleted,
        observations: task.observations,
        moduleId: task.moduleId,
        moduleCode: task.moduleCode,
        moduleName: task.moduleName,
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
        photos: photosByElevator.get(e.id) ?? [],
        finalStatus: e.finalStatus,
        tasks: tasksByElevator.get(e.id) ?? [],
      })),
    };
  } catch (error) {
    console.error("Error al obtener documento de OT del portal:", error);
    return null;
  }
}
