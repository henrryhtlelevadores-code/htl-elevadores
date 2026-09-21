"use server";

import { revalidatePath } from "next/cache";
import {
  db,
  users,
  roles,
  staffProfiles,
  preventiveRoutes,
  preventiveRouteStops,
  contracts,
  serviceTypes,
  contractElevators,
  elevatorUnities,
  costCenters,
  clients,
  workOrders,
  workOrderElevators,
} from "@/db/index";
import { getErrorMessage } from "@/lib/errors";
import { generateUuid } from "@/lib/uuid";
import { routeStopFormSchema, type RouteStopFormValues } from "./schema";
import { type BatchItem } from "drizzle-orm/batch";
import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNull,
  like,
  max,
  or,
} from "drizzle-orm";

// ==========================================
// 1. TÉCNICOS
// ==========================================

export type TechnicianOption = {
  id: string;
  fullName: string;
  specialization: string | null;
};

export async function getTechnicians(): Promise<TechnicianOption[]> {
  try {
    return await db
      .select({
        id: users.id,
        fullName: users.fullName,
        specialization: staffProfiles.specialization,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
      .where(
        and(
          isNull(users.deletedAt),
          eq(users.status, "ACTIVE"),
          like(roles.name, "%TECNICO%")
        )
      )
      .orderBy(asc(users.fullName));
  } catch (error) {
    console.error("Error al obtener técnicos:", error);
    return [];
  }
}

// ==========================================
// 2. RUTAS PREVENTIVAS (TABLERO)
// ==========================================

export type RouteStopWithRelations = {
  id: string;
  routeId: string;
  contractElevatorId: string;
  plannedTime: string;
  orderIndex: number;
  elevatorUnityId: string;
  internalCode: string;
  elevatorName: string;
  costCenterId: string;
  costCenterName: string;
  contractId: string;
  contractNumber: string;
};

export type PreventiveRouteWithStops = {
  id: string;
  technicianId: string;
  businessDayNumber: number;
  name: string | null;
  stops: RouteStopWithRelations[];
};

export async function getPreventiveRoutes(
  technicianId: string
): Promise<PreventiveRouteWithStops[]> {
  try {
    const [routeRows, stopRows] = await Promise.all([
      db
        .select()
        .from(preventiveRoutes)
        .where(
          and(
            eq(preventiveRoutes.technicianId, technicianId),
            eq(preventiveRoutes.isActive, true)
          )
        )
        .orderBy(asc(preventiveRoutes.businessDayNumber)),
      db
        .select({
          id: preventiveRouteStops.id,
          routeId: preventiveRouteStops.routeId,
          contractElevatorId: preventiveRouteStops.contractElevatorId,
          plannedTime: preventiveRouteStops.plannedTime,
          orderIndex: preventiveRouteStops.orderIndex,
          elevatorUnityId: elevatorUnities.id,
          internalCode: elevatorUnities.internalCode,
          elevatorName: elevatorUnities.name,
          costCenterId: costCenters.id,
          costCenterName: costCenters.name,
          contractId: contracts.id,
          contractNumber: contracts.contractNumber,
        })
        .from(preventiveRouteStops)
        .innerJoin(preventiveRoutes, eq(preventiveRouteStops.routeId, preventiveRoutes.id))
        .innerJoin(contractElevators, eq(preventiveRouteStops.contractElevatorId, contractElevators.id))
        .innerJoin(contracts, eq(contractElevators.contractId, contracts.id))
        .innerJoin(elevatorUnities, eq(contractElevators.elevatorUnityId, elevatorUnities.id))
        .innerJoin(costCenters, eq(elevatorUnities.costCenterId, costCenters.id))
        .where(eq(preventiveRoutes.technicianId, technicianId))
        .orderBy(asc(preventiveRouteStops.plannedTime), asc(preventiveRouteStops.orderIndex)),
    ]);

    const stopsByRoute = new Map<string, RouteStopWithRelations[]>();
    for (const s of stopRows) {
      const list = stopsByRoute.get(s.routeId) ?? [];
      list.push({
        id: s.id,
        routeId: s.routeId,
        contractElevatorId: s.contractElevatorId,
        plannedTime: s.plannedTime,
        orderIndex: s.orderIndex ?? 0,
        elevatorUnityId: s.elevatorUnityId,
        internalCode: s.internalCode,
        elevatorName: s.elevatorName,
        costCenterId: s.costCenterId,
        costCenterName: s.costCenterName,
        contractId: s.contractId,
        contractNumber: s.contractNumber,
      });
      stopsByRoute.set(s.routeId, list);
    }

    return routeRows.map((r) => ({
      id: r.id,
      technicianId: r.technicianId,
      businessDayNumber: r.businessDayNumber,
      name: r.name,
      stops: stopsByRoute.get(r.id) ?? [],
    }));
  } catch (error) {
    console.error("Error al obtener rutas preventivas:", error);
    return [];
  }
}

// ==========================================
// 3. CONTRATOS PREVENTIVOS PARA EL FORMULARIO
// ==========================================

export type PreventiveContractOption = {
  id: string;
  contractNumber: string;
  costCenterId: string;
  costCenterName: string;
  clientName: string;
  equipment: Array<{
    id: string;
    elevatorUnityId: string;
    internalCode: string;
    name: string;
  }>;
};

export async function getPreventiveContractOptions(): Promise<PreventiveContractOption[]> {
  try {
    const contractRows = await db
      .select({
        id: contracts.id,
        contractNumber: contracts.contractNumber,
        costCenterId: costCenters.id,
        costCenterName: costCenters.name,
        clientName: clients.legalName,
      })
      .from(contracts)
      .innerJoin(serviceTypes, eq(contracts.serviceTypeId, serviceTypes.id))
      .innerJoin(costCenters, eq(contracts.costCenterId, costCenters.id))
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .where(
        and(
          eq(contracts.status, "ACTIVE"),
          eq(serviceTypes.code, "PREV"),
          isNull(contracts.deletedAt),
          isNull(costCenters.deletedAt)
        )
      )
      .orderBy(asc(costCenters.name), asc(contracts.contractNumber));

    if (contractRows.length === 0) return [];

    const contractIds = contractRows.map((c) => c.id);
    const equipmentRows = await db
      .select({
        id: contractElevators.id,
        contractId: contractElevators.contractId,
        elevatorUnityId: elevatorUnities.id,
        internalCode: elevatorUnities.internalCode,
        name: elevatorUnities.name,
      })
      .from(contractElevators)
      .innerJoin(elevatorUnities, eq(contractElevators.elevatorUnityId, elevatorUnities.id))
      .where(
        and(
          inArray(contractElevators.contractId, contractIds),
          isNull(elevatorUnities.deletedAt)
        )
      )
      .orderBy(asc(elevatorUnities.internalCode));

    const equipmentByContract = new Map<string, PreventiveContractOption["equipment"]>();
    for (const e of equipmentRows) {
      const list = equipmentByContract.get(e.contractId) ?? [];
      list.push({
        id: e.id,
        elevatorUnityId: e.elevatorUnityId,
        internalCode: e.internalCode,
        name: e.name,
      });
      equipmentByContract.set(e.contractId, list);
    }

    return contractRows.map((c) => ({
      ...c,
      equipment: equipmentByContract.get(c.id) ?? [],
    }));
  } catch (error) {
    console.error("Error al obtener contratos preventivos:", error);
    return [];
  }
}

// ==========================================
// 4. CRUD DE PARADAS
// ==========================================

async function ensureRoute(technicianId: string, businessDayNumber: number): Promise<string> {
  const existing = await db
    .select({ id: preventiveRoutes.id })
    .from(preventiveRoutes)
    .where(
      and(
        eq(preventiveRoutes.technicianId, technicianId),
        eq(preventiveRoutes.businessDayNumber, businessDayNumber)
      )
    )
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const id = generateUuid();
  await db.insert(preventiveRoutes).values({
    id,
    technicianId,
    businessDayNumber,
    name: `Ruta - Día ${businessDayNumber}`,
  });
  return id;
}

export async function createRouteStops(data: RouteStopFormValues) {
  try {
    const validated = routeStopFormSchema.parse(data);
    const routeId = await ensureRoute(validated.technicianId, validated.businessDayNumber);

    const [{ total }] = await db
      .select({ total: count() })
      .from(preventiveRouteStops)
      .where(eq(preventiveRouteStops.routeId, routeId));

    const stmts: BatchItem<"sqlite">[] = [];
    validated.contractElevatorIds.forEach((ceId, idx) => {
      stmts.push(
        db.insert(preventiveRouteStops).values({
          id: generateUuid(),
          routeId,
          contractElevatorId: ceId,
          plannedTime: validated.plannedTime,
          orderIndex: total + idx + 1,
        })
      );
    });

    await db.batch(
      stmts as unknown as Parameters<typeof db.batch>[0]
    );
    revalidatePath("/routes");
    return {
      success: true,
      message: `${stmts.length} ${stmts.length === 1 ? "parada agregada" : "paradas agregadas"} al Día ${validated.businessDayNumber}`,
    };
  } catch (error) {
    console.error("Error al crear paradas de ruta:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateRouteStopsTime(ids: string[], plannedTime: string) {
  try {
    if (!ids.length) return { success: false, error: "No hay paradas seleccionadas." };
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(plannedTime)) {
      return { success: false, error: "Hora inválida (formato HH:MM)." };
    }
    await db
      .update(preventiveRouteStops)
      .set({ plannedTime })
      .where(inArray(preventiveRouteStops.id, ids));
    revalidatePath("/routes");
    return { success: true, message: "Hora actualizada" };
  } catch (error) {
    console.error("Error al actualizar hora de paradas:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function moveRouteStops(
  ids: string[],
  technicianId: string,
  businessDayNumber: number
) {
  try {
    if (!ids.length) return { success: false, error: "No hay paradas seleccionadas." };
    if (businessDayNumber < 1 || businessDayNumber > 20) {
      return { success: false, error: "Día hábil inválido." };
    }
    const routeId = await ensureRoute(technicianId, businessDayNumber);

    const [{ maxIndex }] = await db
      .select({ maxIndex: max(preventiveRouteStops.orderIndex) })
      .from(preventiveRouteStops)
      .where(eq(preventiveRouteStops.routeId, routeId));

    let seq = (maxIndex ?? 0) + 1;
    for (const id of ids) {
      await db
        .update(preventiveRouteStops)
        .set({ routeId, orderIndex: seq++ })
        .where(eq(preventiveRouteStops.id, id));
    }

    revalidatePath("/routes");
    return { success: true, message: "Paradas movidas al Día " + businessDayNumber };
  } catch (error) {
    console.error("Error al mover paradas:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteRouteStops(ids: string[]) {
  try {
    if (!ids.length) return { success: false, error: "No hay paradas seleccionadas." };
    await db.delete(preventiveRouteStops).where(inArray(preventiveRouteStops.id, ids));
    revalidatePath("/routes");
    return { success: true, message: "Paradas eliminadas de la ruta" };
  } catch (error) {
    console.error("Error al eliminar paradas:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// 5. GENERAR MES SIGUIENTE (OTS PREVENTIVAS)
// ==========================================

export async function generateNextMonth(technicianId: string) {
  try {
    if (!technicianId) return { success: false, error: "Selecciona un técnico." };

    const now = new Date();
    const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const nextMonth = (now.getMonth() + 1) % 12;
    const monthLabel = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`;
    const monthPrefix = `${monthLabel}-%`;

    const prevRows = await db
      .select({ id: serviceTypes.id })
      .from(serviceTypes)
      .where(eq(serviceTypes.code, "PREV"))
      .limit(1);
    const prevServiceTypeId = prevRows[0]?.id;
    if (!prevServiceTypeId) {
      return { success: false, error: "No existe el tipo de servicio PREV registrado." };
    }

    const existing = await db
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.technicianId, technicianId),
          or(eq(workOrders.type, prevServiceTypeId), eq(workOrders.type, "PREVENTIVE")),
          like(workOrders.scheduledDate, monthPrefix),
          isNull(workOrders.deletedAt)
        )
      )
      .limit(1);
    if (existing.length > 0) {
      return {
        success: false,
        error: "Ya se generaron las OTs preventivas para el próximo mes.",
      };
    }

    const routes = await getPreventiveRoutes(technicianId);
    const stopsByDay = new Map<number, RouteStopWithRelations[]>();
    for (const r of routes) stopsByDay.set(r.businessDayNumber, r.stops);
    if ([...stopsByDay.values()].every((s) => s.length === 0)) {
      return { success: false, error: "La ruta del técnico no tiene paradas para generar." };
    }

    const daysInMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
    const businessDays: Array<{ dayNumber: number; date: Date }> = [];
    let counter = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(nextYear, nextMonth, d);
      const dow = date.getDay();
      if (dow === 0 || dow === 6) continue;
      counter++;
      businessDays.push({ dayNumber: counter, date });
    }

    const [{ total }] = await db
      .select({ total: count() })
      .from(workOrders)
      .where(like(workOrders.otNumber, `OT-${monthLabel}-%`));
    let seq = total + 1;

    const stmts: BatchItem<"sqlite">[] = [];
    for (const day of businessDays) {
      const stops = stopsByDay.get(day.dayNumber) ?? [];
      if (stops.length === 0) continue;
      for (const stop of stops) {
        const [hh, mm] = stop.plannedTime.split(":").map(Number);
        const scheduledDate = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, "0")}-${String(day.date.getDate()).padStart(2, "0")}`;
        const scheduledTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
        const woId = generateUuid();
        stmts.push(
          db.insert(workOrders).values({
            id: woId,
            otNumber: `OT-${monthLabel}-${String(seq).padStart(4, "0")}`,
            costCenterId: stop.costCenterId,
            technicianId,
            type: prevServiceTypeId,
            status: "PENDING",
            priority: "NORMAL",
            scheduledDate,
            scheduledTime,
          }),
          db.insert(workOrderElevators).values({
            id: generateUuid(),
            workOrderId: woId,
            elevatorUnityId: stop.elevatorUnityId,
            status: "PENDING",
          })
        );
        seq++;
      }
    }

    if (stmts.length === 0) {
      return { success: false, error: "La ruta del técnico no tiene paradas para generar." };
    }

    await db.batch(
      stmts as unknown as Parameters<typeof db.batch>[0]
    );
    revalidatePath("/routes");
    revalidatePath("/work-orders");
    return {
      success: true,
      message: `${stmts.length / 2} OTs preventivas generadas para ${monthLabel}.`,
    };
  } catch (error) {
    console.error("Error al generar OTs del siguiente mes:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}