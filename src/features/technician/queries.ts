import "server-only";
import { sql, asc, eq, and, isNull, ne, or } from "drizzle-orm";
import {
  db,
  workOrders,
  workOrderElevators,
  workOrderTasks,
  costCenters,
  clients,
  elevatorUnities,
  users,
  roles,
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
  equipmentCount: number;
};

export type TechnicianElevator = {
  id: string;
  workOrderId: string;
  internalCode: string | null;
  elevatorName: string | null;
  costCenterName: string | null;
  status: string | null;
  finding: string | null;
  evidencePhotoUrls: string[] | null;
  tasks: Array<{
    id: string;
    taskDescription: string;
    isCritical: boolean;
    isCompleted: boolean;
  }>;
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
        equipmentCount,
      })
      .from(workOrders)
      .innerJoin(costCenters, eq(workOrders.costCenterId, costCenters.id))
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .where(
        and(
          eq(workOrders.technicianId, technicianId),
          isNull(workOrders.deletedAt),
          or(ne(workOrders.status, "COMPLETED"), isNull(workOrders.status))
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
        client_name: clients.legalName,
        cost_center_name: costCenters.name,
        technician_name: users.fullName,
      })
      .from(workOrders)
      .innerJoin(costCenters, eq(workOrders.costCenterId, costCenters.id))
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
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

    const elevators = await db
      .select({
        id: workOrderElevators.id,
        workOrderId: workOrderElevators.workOrderId,
        internalCode: elevatorUnities.internalCode,
        elevatorName: elevatorUnities.name,
        costCenterName: costCenters.name,
        status: workOrderElevators.status,
        finding: workOrderElevators.finding,
        evidencePhotoUrls: workOrderElevators.evidencePhotoUrls,
      })
      .from(workOrderElevators)
      .innerJoin(elevatorUnities, eq(workOrderElevators.elevatorUnityId, elevatorUnities.id))
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
      })
      .from(workOrderTasks)
      .innerJoin(workOrderElevators, eq(workOrderTasks.workOrderElevatorId, workOrderElevators.id))
      .where(eq(workOrderElevators.workOrderId, workOrderId))
      .orderBy(asc(workOrderTasks.id));

    const tasksByElevator = new Map<string, TechnicianElevator["tasks"]>();
    for (const task of tasksRows) {
      const list = tasksByElevator.get(task.workOrderElevatorId) ?? [];
      list.push({
        id: task.id,
        taskDescription: task.taskDescription,
        isCritical: !!task.isCritical,
        isCompleted: !!task.isCompleted,
      });
      tasksByElevator.set(task.workOrderElevatorId, list);
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
      elevators: elevators.map((e) => ({
        id: e.id,
        workOrderId: e.workOrderId,
        internalCode: e.internalCode,
        elevatorName: e.elevatorName,
        costCenterName: e.costCenterName,
        status: e.status,
        finding: e.finding,
        evidencePhotoUrls: (e.evidencePhotoUrls as string[] | null) ?? null,
        tasks: tasksByElevator.get(e.id) ?? [],
      })),
    };
  } catch (error) {
    console.error("Error al obtener detalle de OT del técnico:", error);
    return null;
  }
}