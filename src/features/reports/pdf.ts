import "server-only";

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  db,
  workOrders,
  workOrderElevators,
  workOrderTasks,
  workOrderElevatorPhotos,
  maintenanceModules,
  costCenters,
  clients,
  users,
  elevatorUnities,
  serviceTypes,
  ubigeos,
  brands,
  models,
  elevatorTypes,
} from "@/db/index";
import { eq, asc, and, isNull, inArray } from "drizzle-orm";
import {
  WorkOrderReportPDF,
  type WorkOrderReportPdfData,
  type ReportPdfElevator,
  type ReportPdfTask,
  type ReportPdfPhoto,
} from "./components/report-pdf";

const PRIORITY_LABELS: Record<string, string> = {
  HIGH: "Alta",
  NORMAL: "Normal",
  LOW: "Baja",
};

const LEGACY_TYPE_LABELS: Record<string, string> = {
  CORRECTIVE: "Mantenimiento Correctivo",
  PREVENTIVE: "Mantenimiento Preventivo",
  PREDICTIVE: "Mantenimiento Predictivo",
  INSTALLATION: "Instalación",
};

function formatDateTime(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayTime(date: string | null, time?: string | null): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(y, m - 1, d).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return time ? `${base} · ${time}` : base;
}

export async function buildWorkOrderReportPdfData(
  workOrderId: string
): Promise<WorkOrderReportPdfData | null> {
  // Solo reportes aprobados
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
      approvalStatus: workOrders.approvalStatus,
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
      finalStatus: workOrderElevators.finalStatus,
    })
    .from(workOrderElevators)
    .innerJoin(
      elevatorUnities,
      eq(workOrderElevators.elevatorUnityId, elevatorUnities.id)
    )
    .leftJoin(brands, eq(elevatorUnities.brandId, brands.id))
    .leftJoin(models, eq(elevatorUnities.modelId, models.id))
    .leftJoin(elevatorTypes, eq(elevatorUnities.elevatorTypeId, elevatorTypes.id))
    .where(eq(workOrderElevators.workOrderId, workOrderId))
    .orderBy(asc(elevatorUnities.internalCode));

  const elevatorIds = elevatorRows.map((e) => e.id);

  let taskRows: Array<{
    id: string;
    workOrderElevatorId: string;
    taskDescription: string;
    isCritical: boolean | null;
    isCompleted: boolean | null;
    observations: string | null;
    moduleCode: string | null;
    moduleName: string | null;
  }> = [];

  let photoRows: Array<{
    id: string;
    workOrderElevatorId: string;
    url: string;
    tag: string;
    description: string | null;
  }> = [];

  if (elevatorIds.length > 0) {
    [taskRows, photoRows] = await Promise.all([
      db
        .select({
          id: workOrderTasks.id,
          workOrderElevatorId: workOrderTasks.workOrderElevatorId,
          taskDescription: workOrderTasks.taskDescription,
          isCritical: workOrderTasks.isCritical,
          isCompleted: workOrderTasks.isCompleted,
          observations: workOrderTasks.observations,
          moduleCode: maintenanceModules.code,
          moduleName: maintenanceModules.name,
        })
        .from(workOrderTasks)
        .leftJoin(
          maintenanceModules,
          eq(workOrderTasks.moduleId, maintenanceModules.id)
        )
        .where(inArray(workOrderTasks.workOrderElevatorId, elevatorIds))
        .orderBy(asc(workOrderTasks.id)),

      db
        .select({
          id: workOrderElevatorPhotos.id,
          workOrderElevatorId: workOrderElevatorPhotos.workOrderElevatorId,
          url: workOrderElevatorPhotos.url,
          tag: workOrderElevatorPhotos.tag,
          description: workOrderElevatorPhotos.description,
        })
        .from(workOrderElevatorPhotos)
        .where(inArray(workOrderElevatorPhotos.workOrderElevatorId, elevatorIds)),
    ]);
  }

  const tasksByElevator = new Map<string, ReportPdfTask[]>();
  for (const t of taskRows) {
    const list = tasksByElevator.get(t.workOrderElevatorId) ?? [];
    list.push({
      id: t.id,
      taskDescription: t.taskDescription,
      isCritical: !!t.isCritical,
      isCompleted: !!t.isCompleted,
      observations: t.observations,
      moduleCode: t.moduleCode,
      moduleName: t.moduleName,
    });
    tasksByElevator.set(t.workOrderElevatorId, list);
  }

  const photosByElevator = new Map<string, ReportPdfPhoto[]>();
  for (const p of photoRows) {
    const list = photosByElevator.get(p.workOrderElevatorId) ?? [];
    list.push({
      id: p.id,
      url: p.url,
      tag: p.tag,
      description: p.description,
    });
    photosByElevator.set(p.workOrderElevatorId, list);
  }

  const elevators: ReportPdfElevator[] = elevatorRows.map((e) => ({
    id: e.id,
    internalCode: e.internalCode,
    elevatorName: e.elevatorName,
    brandName: e.brandName,
    modelName: e.modelName,
    elevatorTypeName: e.elevatorTypeName,
    finding: e.finding,
    finalStatus: e.finalStatus,
    tasks: tasksByElevator.get(e.id) ?? [],
    photos: photosByElevator.get(e.id) ?? [],
  }));

  const serviceType =
    wo.serviceTypeName ?? LEGACY_TYPE_LABELS[wo.type ?? ""] ?? "Mantenimiento";

  const generatedDateText = new Date().toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return {
    otNumber: wo.otNumber,
    serviceTypeName: serviceType,
    priority: PRIORITY_LABELS[wo.priority ?? ""] ?? wo.priority ?? "Normal",
    clientName: wo.clientName ?? "—",
    costCenterName: wo.costCenterName ?? "—",
    costCenterAddress: wo.costCenterAddress ?? "—",
    costCenterDistrict: wo.costCenterDistrict ?? "—",
    technicianName: wo.technicianName ?? "Técnico HTL",
    scheduledText: formatDayTime(wo.scheduledDate, wo.scheduledTime),
    startedText: formatDateTime(wo.startedAt),
    completedText: formatDateTime(wo.completedAt),
    closingNotes: wo.closingNotes,
    clientSignerName: wo.clientSignerName,
    clientSignatureUrl: wo.clientSignatureUrl,
    generatedDateText,
    elevators,
  };
}

export async function renderWorkOrderReportPdf(
  workOrderId: string
): Promise<Buffer> {
  const data = await buildWorkOrderReportPdfData(workOrderId);
  if (!data) {
    throw new Error("Reporte no encontrado o no ha sido aprobado");
  }

  return renderToBuffer(
    React.createElement(WorkOrderReportPDF, { data }) as unknown as Parameters<
      typeof renderToBuffer
    >[0]
  );
}
