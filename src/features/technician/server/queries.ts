import "server-only";
import { sql, asc, eq, and, isNull, or, inArray } from "drizzle-orm";
import {
  db,
  workOrders,
  workOrderElevators,
  workOrderTasks,
  maintenanceModules,
  workOrderElevatorPhotos,
  workOrderElevatorSafety,
  workOrderElevatorSafetyItems,
  costCenters,
  clients,
  elevatorUnities,
  users,
  roles,
  serviceTypes,
  ubigeos,
  elevatorTypes,
  brands,
  costCenterContacts,
} from "@/db/index";
import { getSessionUserId } from "@/features/auth/server";

export interface TechnicianContext {
  userId: string;
  fullName: string;
  roleName: string | null;
}

export type TechnicianWorkOrder = {
  id: string;
  otNumber: string;
  status: string | null;
  priority: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  client_name: string;
  cost_center_name: string;
  cost_center_address: string | null;
  cost_center_phone: string | null;
  service_type_code: string | null;
  service_type_name: string | null;
  service_type_category: string | null;
  equipmentCount: number;
};

export type TechnicianEmergency = {
  id: string;
  otNumber: string;
  status: string | null;
  cost_center_name: string;
  cost_center_address: string | null;
  /** Fecha límite (epoch, segundos) estimada desde la creación según el SLA del tipo. */
  slaDeadline: number;
};

export type TechnicianSafetyItem = {
  id: string;
  question: string;
  response: string | null;
  observations: string | null;
  orderIndex: number;
  answeredAt: number | null;
};

export type TechnicianSafety = {
  id: string | null;
  status: string | null;
  notes: string | null;
  technicianSignatureUrl: string | null;
  completedAt: number | null;
  items: TechnicianSafetyItem[];
};

export type TechnicianTask = {
  id: string;
  taskDescription: string;
  isCritical: boolean;
  isCompleted: boolean;
  status: string | null;
  observations: string | null;
  moduleId: string | null;
  moduleCode: string | null;
  moduleName: string | null;
  completedAt: number | null;
};

export type TechnicianElevatorPhoto = {
  id: string;
  url: string;
  tag: string;
  description: string | null;
  workOrderTaskId: string | null;
  createdAt: number | null;
};

export type TechnicianElevator = {
  id: string;
  workOrderId: string;
  internalCode: string | null;
  elevatorName: string | null;
  elevatorType: string | null;
  brand: string | null;
  costCenterName: string | null;
  status: string | null;
  finding: string | null;
  evidencePhotoUrls: string[] | null;
  /** La evidencia fotográfica mínima solo aplica a preventivos/correctivos. */
  photosRequired: boolean;
  safety: TechnicianSafety | null;
  tasks: TechnicianTask[];
  photos: TechnicianElevatorPhoto[];
};

export type TechnicianWorkOrderExecution = {
  id: string;
  otNumber: string;
  status: string | null;
  priority: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  startedAt: number | null;
  completedAt: number | null;
  clientSignatureUrl: string | null;
  clientSignerName: string | null;
  client_name: string | null;
  cost_center_name: string | null;
  technician_name: string | null;
  description: string | null;
  serviceType: {
    code: string | null;
    name: string | null;
    category: string | null;
    defaultSlaMins: number | null;
  } | null;
  costCenter: {
    id: string;
    name: string;
    address: string | null;
    district: string | null;
    latitude: number | null;
    longitude: number | null;
    contact: {
      fullName: string;
      role: string | null;
      phone: string | null;
    } | null;
  } | null;
  elevators: TechnicianElevator[];
};

export async function getTechnicianContext(): Promise<TechnicianContext | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const rows = await db
    .select({ fullName: users.fullName, role_name: roles.name })
    .from(users)
    .leftJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return { userId, fullName: row.fullName, roleName: row.role_name };
}

export async function getTechnicianWorkOrders(
  technicianId: string
): Promise<TechnicianWorkOrder[]> {
  try {
    const equipmentCount = sql<number>`(SELECT COUNT(*) FROM work_order_elevators woe WHERE woe.work_order_id = work_orders.id)`;
    const contactPhone = sql<string | null>`(SELECT cc.phone FROM cost_center_contacts cc WHERE cc.cost_center_id = cost_center.id AND cc.is_active = 1 AND cc.phone IS NOT NULL AND cc.phone <> '' LIMIT 1)`;

    return await db
      .select({
        id: workOrders.id,
        otNumber: workOrders.otNumber,
        status: workOrders.status,
        priority: workOrders.priority,
        scheduledDate: workOrders.scheduledDate,
        scheduledTime: workOrders.scheduledTime,
        client_name: clients.legalName,
        cost_center_name: costCenters.name,
        cost_center_address: costCenters.address,
        cost_center_phone: contactPhone,
        service_type_code: serviceTypes.code,
        service_type_name: serviceTypes.name,
        service_type_category: serviceTypes.category,
        equipmentCount,
      })
      .from(workOrders)
      .innerJoin(costCenters, eq(workOrders.costCenterId, costCenters.id))
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
      .where(
        and(
          eq(workOrders.technicianId, technicianId),
          isNull(workOrders.deletedAt)
        )
      )
      .orderBy(
        sql`${workOrders.scheduledDate} IS NULL`,
        asc(workOrders.scheduledDate),
        asc(workOrders.scheduledTime)
      );
  } catch (error) {
    console.error("Error al obtener OTs del técnico:", error);
    return [];
  }
}

/**
 * Emergencias activas del técnico (tipo de servicio EMERGENCIA todavía en
 * PENDING o IN_PROGRESS). Siempre se muestran arriba, sin importar los filtros.
 */
export async function getTechnicianEmergencies(
  technicianId: string
): Promise<TechnicianEmergency[]> {
  try {
    return await db
      .select({
        id: workOrders.id,
        otNumber: workOrders.otNumber,
        status: workOrders.status,
        cost_center_name: costCenters.name,
        cost_center_address: costCenters.address,
        slaDeadline: sql<number>`(COALESCE(${workOrders.createdAt}, unixepoch()) + COALESCE(${serviceTypes.defaultSlaMins}, 60) * 60)`,
      })
      .from(workOrders)
      .innerJoin(costCenters, eq(workOrders.costCenterId, costCenters.id))
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .innerJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
      .where(
        and(
          eq(workOrders.technicianId, technicianId),
          isNull(workOrders.deletedAt),
          eq(serviceTypes.category, "EMERGENCIA"),
          or(
            isNull(workOrders.status),
            inArray(workOrders.status, ["PENDING", "IN_PROGRESS"])
          )
        )
      )
      .orderBy(asc(workOrders.createdAt));
  } catch (error) {
    console.error("Error al obtener emergencias del técnico:", error);
    return [];
  }
}

export async function getTechnicianWorkOrderExecution(
  technicianId: string,
  workOrderId: string
): Promise<TechnicianWorkOrderExecution | null> {
  try {
    const rows = await db
      .select({
        id: workOrders.id,
        otNumber: workOrders.otNumber,
        status: workOrders.status,
        priority: workOrders.priority,
        scheduledDate: workOrders.scheduledDate,
        scheduledTime: workOrders.scheduledTime,
        startedAt: workOrders.startedAt,
        completedAt: workOrders.completedAt,
        clientSignatureUrl: workOrders.clientSignatureUrl,
        clientSignerName: workOrders.clientSignerName,
        description: workOrders.description,
        client_name: clients.legalName,
        cost_center_name: costCenters.name,
        cost_center_id: costCenters.id,
        cost_center_address: costCenters.address,
        cost_center_district: ubigeos.distrito,
        cost_center_latitude: costCenters.latitude,
        cost_center_longitude: costCenters.longitude,
        service_type_code: serviceTypes.code,
        service_type_name: serviceTypes.name,
        service_type_category: serviceTypes.category,
        service_type_default_sla_mins: serviceTypes.defaultSlaMins,
        technician_name: users.fullName,
      })
      .from(workOrders)
      .innerJoin(costCenters, eq(workOrders.costCenterId, costCenters.id))
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
      .leftJoin(ubigeos, eq(costCenters.ubigeoId, ubigeos.id))
      .leftJoin(users, eq(workOrders.technicianId, users.id))
      .where(
        and(
          eq(workOrders.id, workOrderId),
          eq(workOrders.technicianId, technicianId),
          isNull(workOrders.deletedAt)
        )
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    // Contacto en sitio: se prefiere el Administrador activo, luego cualquier
    // contacto activo.
    const contactRows = await db
      .select({
        id: costCenterContacts.id,
        fullName: costCenterContacts.fullName,
        role: costCenterContacts.role,
        phone: costCenterContacts.phone,
        isActive: costCenterContacts.isActive,
      })
      .from(costCenterContacts)
      .where(eq(costCenterContacts.costCenterId, row.cost_center_id))
      .orderBy(
        sql`(${costCenterContacts.isActive} = 1) DESC`,
        sql`(${costCenterContacts.role} = 'Administrador') DESC`,
        asc(costCenterContacts.id)
      )
      .limit(1);
    const contact = contactRows[0];
    const contactInfo =
      contact && contact.isActive
        ? {
            fullName: contact.fullName,
            role: contact.role,
            phone: contact.phone,
          }
        : null;

    const serviceTypeRows = await db
      .select({ code: serviceTypes.code })
      .from(workOrders)
      .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
      .where(eq(workOrders.id, workOrderId))
      .limit(1);
    const serviceTypeCode = serviceTypeRows[0]?.code ?? null;
    const photosRequired = serviceTypeCode === "PREV" || serviceTypeCode === "CORR";

    const elevators = await db
      .select({
        id: workOrderElevators.id,
        workOrderId: workOrderElevators.workOrderId,
        internalCode: elevatorUnities.internalCode,
        elevatorName: elevatorUnities.name,
        elevatorType: elevatorTypes.name,
        brand: brands.name,
        costCenterName: costCenters.name,
        status: workOrderElevators.status,
        finding: workOrderElevators.finding,
        evidencePhotoUrls: workOrderElevators.evidencePhotoUrls,
      })
      .from(workOrderElevators)
      .innerJoin(elevatorUnities, eq(workOrderElevators.elevatorUnityId, elevatorUnities.id))
      .leftJoin(elevatorTypes, eq(elevatorUnities.elevatorTypeId, elevatorTypes.id))
      .leftJoin(brands, eq(elevatorUnities.brandId, brands.id))
      .innerJoin(costCenters, eq(elevatorUnities.costCenterId, costCenters.id))
      .where(eq(workOrderElevators.workOrderId, workOrderId))
      .orderBy(asc(elevatorUnities.internalCode));

    const tasksRows = await db
      .select({
        id: workOrderTasks.id,
        workOrderElevatorId: workOrderTasks.workOrderElevatorId,
        taskDescription: workOrderTasks.taskDescription,
        isCritical: workOrderTasks.isCritical,
        isCompleted: workOrderTasks.isCompleted,
        status: workOrderTasks.status,
        observations: workOrderTasks.observations,
        completedAt: workOrderTasks.completedAt,
        moduleId: workOrderTasks.moduleId,
        moduleCode: maintenanceModules.code,
        moduleName: maintenanceModules.name,
      })
      .from(workOrderTasks)
      .innerJoin(workOrderElevators, eq(workOrderTasks.workOrderElevatorId, workOrderElevators.id))
      .leftJoin(maintenanceModules, eq(workOrderTasks.moduleId, maintenanceModules.id))
      .where(eq(workOrderElevators.workOrderId, workOrderId))
      .orderBy(
        asc(maintenanceModules.code),
        asc(workOrderTasks.id)
      );

    const tasksByElevator = new Map<string, TechnicianTask[]>();
    for (const task of tasksRows) {
      const list = tasksByElevator.get(task.workOrderElevatorId) ?? [];
      list.push({
        id: task.id,
        taskDescription: task.taskDescription,
        isCritical: !!task.isCritical,
        isCompleted: !!task.isCompleted,
        status: task.status,
        observations: task.observations,
        completedAt: task.completedAt,
        moduleId: task.moduleId,
        moduleCode: task.moduleCode,
        moduleName: task.moduleName,
      });
      tasksByElevator.set(task.workOrderElevatorId, list);
    }

    const elevatorIds = elevators.map((e) => e.id);

    const safetyRows = await db
      .select({
        id: workOrderElevatorSafety.id,
        workOrderElevatorId: workOrderElevatorSafety.workOrderElevatorId,
        status: workOrderElevatorSafety.status,
        notes: workOrderElevatorSafety.notes,
        technicianSignatureUrl: workOrderElevatorSafety.technicianSignatureUrl,
        completedAt: workOrderElevatorSafety.completedAt,
      })
      .from(workOrderElevatorSafety)
      .where(inArray(workOrderElevatorSafety.workOrderElevatorId, elevatorIds));

    const safetyByElevator = new Map<string, TechnicianSafety>();
    const safetyById = new Map<string, TechnicianSafety>();
    for (const safety of safetyRows) {
      const record: TechnicianSafety = {
        id: safety.id,
        status: safety.status,
        notes: safety.notes,
        technicianSignatureUrl: safety.technicianSignatureUrl,
        completedAt: safety.completedAt,
        items: [],
      };
      safetyByElevator.set(safety.workOrderElevatorId, record);
      if (safety.id) safetyById.set(safety.id, record);
    }
    const safetyIds = Array.from(safetyById.keys());

    const itemRows = safetyIds.length > 0
      ? await db
          .select({
            id: workOrderElevatorSafetyItems.id,
            safetyRecordId: workOrderElevatorSafetyItems.safetyRecordId,
            question: workOrderElevatorSafetyItems.question,
            response: workOrderElevatorSafetyItems.response,
            observations: workOrderElevatorSafetyItems.observations,
            orderIndex: workOrderElevatorSafetyItems.orderIndex,
            answeredAt: workOrderElevatorSafetyItems.answeredAt,
          })
          .from(workOrderElevatorSafetyItems)
          .where(inArray(workOrderElevatorSafetyItems.safetyRecordId, safetyIds))
          .orderBy(asc(workOrderElevatorSafetyItems.orderIndex))
      : [];
    for (const item of itemRows) {
      const safety = safetyById.get(item.safetyRecordId);
      if (!safety) continue;
      safety.items.push({
        id: item.id,
        question: item.question,
        response: item.response,
        observations: item.observations,
        orderIndex: item.orderIndex ?? 0,
        answeredAt: item.answeredAt,
      });
    }

    const photoRows = elevatorIds.length > 0
      ? await db
          .select({
            id: workOrderElevatorPhotos.id,
            workOrderElevatorId: workOrderElevatorPhotos.workOrderElevatorId,
            workOrderTaskId: workOrderElevatorPhotos.workOrderTaskId,
            url: workOrderElevatorPhotos.url,
            tag: workOrderElevatorPhotos.tag,
            description: workOrderElevatorPhotos.description,
            createdAt: workOrderElevatorPhotos.createdAt,
          })
          .from(workOrderElevatorPhotos)
          .where(inArray(workOrderElevatorPhotos.workOrderElevatorId, elevatorIds))
          .orderBy(asc(workOrderElevatorPhotos.createdAt))
      : [];
    const photosByElevator = new Map<string, TechnicianElevatorPhoto[]>();
    for (const photo of photoRows) {
      const list = photosByElevator.get(photo.workOrderElevatorId) ?? [];
      list.push({
        id: photo.id,
        url: photo.url,
        tag: photo.tag,
        description: photo.description,
        workOrderTaskId: photo.workOrderTaskId,
        createdAt: photo.createdAt,
      });
      photosByElevator.set(photo.workOrderElevatorId, list);
    }

    return {
      id: row.id,
      otNumber: row.otNumber,
      status: row.status,
      priority: row.priority,
      scheduledDate: row.scheduledDate,
      scheduledTime: row.scheduledTime,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      clientSignatureUrl: row.clientSignatureUrl,
      clientSignerName: row.clientSignerName,
      client_name: row.client_name,
      cost_center_name: row.cost_center_name,
      technician_name: row.technician_name,
      description: row.description,
      serviceType: row.service_type_code
        ? {
            code: row.service_type_code,
            name: row.service_type_name,
            category: row.service_type_category,
            defaultSlaMins: row.service_type_default_sla_mins,
          }
        : null,
      costCenter: {
        id: row.cost_center_id,
        name: row.cost_center_name,
        address: row.cost_center_address,
        district: row.cost_center_district,
        latitude: row.cost_center_latitude,
        longitude: row.cost_center_longitude,
        contact: contactInfo,
      },
      elevators: elevators.map((e) => ({
        id: e.id,
        workOrderId: e.workOrderId,
        internalCode: e.internalCode,
        elevatorName: e.elevatorName,
        elevatorType: e.elevatorType,
        brand: e.brand,
        costCenterName: e.costCenterName,
        status: e.status,
        finding: e.finding,
        evidencePhotoUrls: (e.evidencePhotoUrls as string[] | null) ?? null,
        photosRequired,
        safety: safetyByElevator.get(e.id) ?? null,
        tasks: tasksByElevator.get(e.id) ?? [],
        photos: photosByElevator.get(e.id) ?? [],
      })),
    };
  } catch (error) {
    console.error("Error al obtener detalle de OT del técnico:", error);
    return null;
  }
}
