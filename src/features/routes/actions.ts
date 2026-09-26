"use server";

import { revalidatePath } from "next/cache";
import {
  db,
  users,
  roles,
  staffProfiles,
  preventiveRoutes,
  preventiveRouteStops,
  preventiveRouteConfig,
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
import { routeStopFormSchema, routeConfigSchema, type RouteStopFormValues } from "./schema";
import { groupStopsByVisit, isContractInactive, visitKeyOfStop } from "./visits";
import {
  ROUTE_DEFAULTS,
  buildMonthSchedule,
  isValidMonth,
  nextMonthLabel,
  resolveDayCapacity,
  type RouteConfigValues,
} from "./schedule";
import { type BatchItem } from "drizzle-orm/batch";
import { and, asc, count, eq, inArray, isNull, like, max } from "drizzle-orm";
import { getSessionUserId } from "@/features/auth/server";

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
  visitGroupId: string | null;
  contractElevatorId: string;
  plannedTime: string;
  orderIndex: number;
  estimatedDurationMins: number;
  generatedWorkOrderId: string | null;
  generatedMonth: string | null;
  generatedAt: number | null;
  elevatorUnityId: string;
  internalCode: string;
  elevatorName: string;
  costCenterId: string;
  costCenterName: string;
  clientName: string;
  contractId: string;
  contractNumber: string;
  contractStatus: string | null;
  contractDeletedAt: number | null;
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
          visitGroupId: preventiveRouteStops.visitGroupId,
          plannedTime: preventiveRouteStops.plannedTime,
          orderIndex: preventiveRouteStops.orderIndex,
          estimatedDurationMins: preventiveRouteStops.estimatedDurationMins,
          generatedWorkOrderId: preventiveRouteStops.generatedWorkOrderId,
          generatedMonth: preventiveRouteStops.generatedMonth,
          generatedAt: preventiveRouteStops.generatedAt,
          elevatorUnityId: elevatorUnities.id,
          internalCode: elevatorUnities.internalCode,
          elevatorName: elevatorUnities.name,
          costCenterId: costCenters.id,
          costCenterName: costCenters.name,
          clientName: clients.legalName,
          contractId: contracts.id,
          contractNumber: contracts.contractNumber,
          contractStatus: contracts.status,
          contractDeletedAt: contracts.deletedAt,
        })
        .from(preventiveRouteStops)
        .innerJoin(preventiveRoutes, eq(preventiveRouteStops.routeId, preventiveRoutes.id))
        .innerJoin(contractElevators, eq(preventiveRouteStops.contractElevatorId, contractElevators.id))
        .innerJoin(contracts, eq(contractElevators.contractId, contracts.id))
        .innerJoin(elevatorUnities, eq(contractElevators.elevatorUnityId, elevatorUnities.id))
        .innerJoin(costCenters, eq(elevatorUnities.costCenterId, costCenters.id))
        .innerJoin(clients, eq(costCenters.clientId, clients.id))
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
        visitGroupId: s.visitGroupId,
        plannedTime: s.plannedTime,
        orderIndex: s.orderIndex ?? 0,
        estimatedDurationMins: s.estimatedDurationMins ?? ROUTE_DEFAULTS.defaultStopDurationMins,
        generatedWorkOrderId: s.generatedWorkOrderId,
        generatedMonth: s.generatedMonth,
        generatedAt: s.generatedAt,
        elevatorUnityId: s.elevatorUnityId,
        internalCode: s.internalCode,
        elevatorName: s.elevatorName,
        costCenterId: s.costCenterId,
        costCenterName: s.costCenterName,
        clientName: s.clientName,
        contractId: s.contractId,
        contractNumber: s.contractNumber,
        contractStatus: s.contractStatus,
        contractDeletedAt: s.contractDeletedAt,
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
// 3.1 CONFIGURACIÓN POR TÉCNICO
// ==========================================

export type RouteConfigRow = RouteConfigValues & {
  updatedAt: number | null;
  canEditMaxDays: boolean;
};

async function isAdminUser(): Promise<boolean> {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return false;
    const [row] = await db
      .select({ roleName: roles.name })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, sessionUserId))
      .limit(1);
    return (row?.roleName ?? "").toUpperCase().includes("ADMIN");
  } catch {
    return false;
  }
}

export async function getRouteConfig(technicianId: string): Promise<RouteConfigRow> {
  const canEditMaxDays = await isAdminUser();
  if (!technicianId) {
    return {
      technicianId: "",
      ...ROUTE_DEFAULTS,
      updatedAt: null,
      canEditMaxDays,
    };
  }
  try {
    const rows = await db
      .select()
      .from(preventiveRouteConfig)
      .where(eq(preventiveRouteConfig.technicianId, technicianId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return {
        technicianId,
        totalDays: ROUTE_DEFAULTS.totalDays,
        maxDays: ROUTE_DEFAULTS.maxDays,
        includeSaturdays: ROUTE_DEFAULTS.includeSaturdays,
        saturdayMaxHours: ROUTE_DEFAULTS.saturdayMaxHours,
        defaultStopDurationMins: ROUTE_DEFAULTS.defaultStopDurationMins,
        updatedAt: null,
        canEditMaxDays,
      };
    }
    return {
      technicianId: row.technicianId,
      totalDays: row.totalDays ?? ROUTE_DEFAULTS.totalDays,
      maxDays: row.maxDays ?? ROUTE_DEFAULTS.maxDays,
      includeSaturdays: row.includeSaturdays ?? ROUTE_DEFAULTS.includeSaturdays,
      saturdayMaxHours: row.saturdayMaxHours ?? ROUTE_DEFAULTS.saturdayMaxHours,
      defaultStopDurationMins:
        row.defaultStopDurationMins ?? ROUTE_DEFAULTS.defaultStopDurationMins,
      updatedAt: row.updatedAt ?? null,
      canEditMaxDays,
    };
  } catch (error) {
    console.error("Error al obtener configuración de ruta:", error);
    return {
      technicianId,
      ...ROUTE_DEFAULTS,
      updatedAt: null,
      canEditMaxDays,
    };
  }
}

export async function updateRouteConfig(technicianId: string, input: unknown) {
  try {
    if (!technicianId) return { success: false, error: "Selecciona un técnico." };
    const parsed = routeConfigSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const canEditMaxDays = await isAdminUser();
    if (parsed.data.maxDays !== undefined && !canEditMaxDays) {
      return { success: false, error: "Solo un administrador puede modificar el máximo de días." };
    }

    const current = await getRouteConfig(technicianId);
    const maxDays = parsed.data.maxDays ?? current.maxDays;
    if (parsed.data.totalDays > maxDays) {
      return {
        success: false,
        error: `El total de días (${parsed.data.totalDays}) no puede superar el máximo permitido (${maxDays}).`,
      };
    }

    const values = {
      technicianId,
      totalDays: parsed.data.totalDays,
      maxDays,
      includeSaturdays: parsed.data.includeSaturdays,
      saturdayMaxHours: parsed.data.saturdayMaxHours,
      defaultStopDurationMins: parsed.data.defaultStopDurationMins,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    const existing = await db
      .select({ id: preventiveRouteConfig.technicianId })
      .from(preventiveRouteConfig)
      .where(eq(preventiveRouteConfig.technicianId, technicianId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(preventiveRouteConfig)
        .set(values)
        .where(eq(preventiveRouteConfig.technicianId, technicianId));
    } else {
      await db.insert(preventiveRouteConfig).values(values);
    }

    revalidatePath("/routes");
    return { success: true, message: "Configuración de ruta actualizada" };
  } catch (error) {
    console.error("Error al actualizar configuración de ruta:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function resetRouteConfig(technicianId: string) {
  try {
    if (!technicianId) return { success: false, error: "Selecciona un técnico." };
    const values = {
      technicianId,
      ...ROUTE_DEFAULTS,
      updatedAt: Math.floor(Date.now() / 1000),
    };
    const existing = await db
      .select({ id: preventiveRouteConfig.technicianId })
      .from(preventiveRouteConfig)
      .where(eq(preventiveRouteConfig.technicianId, technicianId))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(preventiveRouteConfig)
        .set(values)
        .where(eq(preventiveRouteConfig.technicianId, technicianId));
    } else {
      await db.insert(preventiveRouteConfig).values(values);
    }
    revalidatePath("/routes");
    return { success: true, message: "Configuración restablecida a valores por defecto" };
  } catch (error) {
    console.error("Error al restablecer configuración de ruta:", error);
    return { success: false, error: getErrorMessage(error) };
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

export type DayLoad = {
  stops: number;
  visits: number;
  minutes: number;
  maxMinutes: number;
  isSaturday: boolean;
  date: string | null;
};

export async function getDayLoads(
  technicianId: string,
  config: RouteConfigValues,
  referenceMonth = nextMonthLabel()
): Promise<Map<number, DayLoad>> {
  const routes = await getPreventiveRoutes(technicianId);
  const loads = new Map<number, DayLoad>();
  for (let day = 1; day <= config.totalDays; day++) {
    const capacity = resolveDayCapacity(referenceMonth, day, config);
    loads.set(day, {
      stops: 0,
      visits: 0,
      minutes: 0,
      maxMinutes: capacity.maxMinutes,
      isSaturday: capacity.isSaturday,
      date: capacity.date,
    });
  }
  for (const route of routes) {
    if (route.businessDayNumber < 1 || route.businessDayNumber > config.totalDays) continue;
    const entry = loads.get(route.businessDayNumber);
    if (!entry) continue;
    entry.stops += route.stops.length;
    // La carga se cuenta por visita (grupo), no por equipo.
    for (const group of groupStopsByVisit(route.stops)) {
      entry.visits += 1;
      entry.minutes += group[0]?.estimatedDurationMins ?? ROUTE_DEFAULTS.defaultStopDurationMins;
    }
  }
  return loads;
}

function assertDayCapacity(load: DayLoad, addedMinutes: number): string | null {
  if (addedMinutes <= 0) return null;
  const effective = load.minutes + addedMinutes;
  if (effective > load.maxMinutes) {
    const maxHours = (load.maxMinutes / 60).toLocaleString("es-PE");
    return `El día supera el máximo de ${maxHours}h${
      load.isSaturday ? " (sábado)" : ""
    }. Actual: ${(load.minutes / 60).toFixed(1)}h + ${(addedMinutes / 60).toFixed(1)}h.`;
  }
  return null;
}

async function validateCapacityForCreate(
  technicianId: string,
  businessDayNumber: number,
  addedMinutes: number
): Promise<string | null> {
  const config = await getRouteConfig(technicianId);
  if (businessDayNumber > config.totalDays) {
    return `El Día ${businessDayNumber} está fuera del rango configurado (1-${config.totalDays}).`;
  }
  const loads = await getDayLoads(technicianId, config);
  const load = loads.get(businessDayNumber);
  if (!load) return `El Día ${businessDayNumber} no existe en la configuración.`;
  return assertDayCapacity(load, addedMinutes);
}

async function validateCapacityForMove(
  technicianId: string,
  businessDayNumber: number,
  stopIds: string[]
): Promise<string | null> {
  const config = await getRouteConfig(technicianId);
  if (businessDayNumber > config.totalDays) {
    return `El Día ${businessDayNumber} está fuera del rango configurado (1-${config.totalDays}).`;
  }

  const routes = await getPreventiveRoutes(technicianId);
  const targetRouteId = routes.find((r) => r.businessDayNumber === businessDayNumber)?.id ?? null;

  const movingRows = await db
    .select({
      id: preventiveRouteStops.id,
      routeId: preventiveRouteStops.routeId,
      estimatedDurationMins: preventiveRouteStops.estimatedDurationMins,
    })
    .from(preventiveRouteStops)
    .where(inArray(preventiveRouteStops.id, stopIds));

  // Los stops que ya están en el día destino no suman carga adicional.
  const netAdded = movingRows.reduce(
    (acc, row) =>
      row.routeId === targetRouteId
        ? acc
        : acc + (row.estimatedDurationMins || ROUTE_DEFAULTS.defaultStopDurationMins),
    0
  );

  const loads = await getDayLoads(technicianId, config);
  const load = loads.get(businessDayNumber);
  if (!load) return `El Día ${businessDayNumber} no existe en la configuración.`;
  return assertDayCapacity(load, netAdded);
}

export async function createRouteStops(data: RouteStopFormValues) {
  try {
    const validated = routeStopFormSchema.parse(data);
    const config = await getRouteConfig(validated.technicianId);
    if (validated.businessDayNumber > config.totalDays) {
      return {
        success: false,
        error: `El Día ${validated.businessDayNumber} está fuera del rango configurado (1-${config.totalDays}).`,
      };
    }

    // Resuelve los equipos del contrato a sus paradas (contract_elevator).
    const equipment = await db
      .select({ id: contractElevators.id, elevatorUnityId: contractElevators.elevatorUnityId })
      .from(contractElevators)
      .innerJoin(elevatorUnities, eq(contractElevators.elevatorUnityId, elevatorUnities.id))
      .where(
        and(
          eq(contractElevators.contractId, validated.contractId),
          inArray(contractElevators.elevatorUnityId, validated.elevatorUnityIds),
          isNull(elevatorUnities.deletedAt)
        )
      );
    if (equipment.length !== validated.elevatorUnityIds.length) {
      return {
        success: false,
        error: "Uno o más equipos no pertenecen al contrato seleccionado.",
      };
    }

    // Cada visita (grupo) suma su duración estimada una sola vez.
    const capacityError = await validateCapacityForCreate(
      validated.technicianId,
      validated.businessDayNumber,
      validated.estimatedDurationMins
    );
    if (capacityError) return { success: false, error: capacityError };

    const routeId = await ensureRoute(validated.technicianId, validated.businessDayNumber);
    const visitGroupId = generateUuid();

    const [{ total }] = await db
      .select({ total: count() })
      .from(preventiveRouteStops)
      .where(eq(preventiveRouteStops.routeId, routeId));

    const stmts: BatchItem<"sqlite">[] = [];
    equipment.forEach((eqRow, idx) => {
      stmts.push(
        db.insert(preventiveRouteStops).values({
          id: generateUuid(),
          routeId,
          visitGroupId,
          contractElevatorId: eqRow.id,
          plannedTime: validated.plannedTime,
          estimatedDurationMins: validated.estimatedDurationMins,
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
      message: `Visita con ${stmts.length} ${stmts.length === 1 ? "equipo" : "equipos"} agregada al Día ${validated.businessDayNumber}`,
    };
  } catch (error) {
    console.error("Error al crear paradas de ruta:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateRouteStopDuration(ids: string[], estimatedDurationMins: number) {
  try {
    if (!ids.length) return { success: false, error: "No hay paradas seleccionadas." };
    const mins = Math.trunc(estimatedDurationMins);
    if (!Number.isFinite(mins) || mins < 15 || mins > 600) {
      return { success: false, error: "Duración inválida (entre 15 y 600 minutos)." };
    }
    await db
      .update(preventiveRouteStops)
      .set({ estimatedDurationMins: mins })
      .where(inArray(preventiveRouteStops.id, ids));
    revalidatePath("/routes");
    return { success: true, message: "Duración actualizada" };
  } catch (error) {
    console.error("Error al actualizar duración de paradas:", error);
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
    if (!Number.isInteger(businessDayNumber) || businessDayNumber < 1) {
      return { success: false, error: "Día hábil inválido." };
    }
    const capacityError = await validateCapacityForMove(
      technicianId,
      businessDayNumber,
      ids
    );
    if (capacityError) return { success: false, error: capacityError };
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
// 5. GENERACIÓN MENSUAL DE OTs PREVENTIVAS
// ==========================================

export type GenerationError = {
  stopId: string;
  visitGroupId: string | null;
  businessDayNumber: number;
  costCenterName: string;
  equipmentCount: number;
  message: string;
};

export type GenerationResult = {
  success: boolean;
  month: string;
  created: number;
  skipped: number;
  errors: GenerationError[];
  error?: string;
};

export async function generateMonth(
  technicianId: string,
  month: string = nextMonthLabel()
): Promise<GenerationResult> {
  const empty: GenerationResult = {
    success: false,
    month,
    created: 0,
    skipped: 0,
    errors: [],
  };
  try {
    if (!technicianId) return { ...empty, error: "Selecciona un técnico." };
    if (!isValidMonth(month)) {
      return { ...empty, error: "Mes inválido (formato YYYY-MM)." };
    }

    const config = await getRouteConfig(technicianId);

    const prevRows = await db
      .select({ id: serviceTypes.id })
      .from(serviceTypes)
      .where(eq(serviceTypes.code, "PREV"))
      .limit(1);
    const prevServiceTypeId = prevRows[0]?.id;
    if (!prevServiceTypeId) {
      return { ...empty, error: "No existe el tipo de servicio PREV registrado." };
    }

    const schedule = buildMonthSchedule(month, config.totalDays, config.includeSaturdays);
    if (schedule.size === 0) {
      return { ...empty, error: "No se pudieron calcular los días hábiles del mes." };
    }

    const routes = await getPreventiveRoutes(technicianId);
    const errors: GenerationError[] = [];
    const pendingGroups: Array<{
      key: string;
      stops: RouteStopWithRelations[];
      day: number;
      date: string;
    }> = [];
    let skipped = 0;

    for (const route of routes) {
      if (route.businessDayNumber > config.totalDays) continue;
      const date = schedule.get(route.businessDayNumber);
      if (!date) continue;

      for (const group of groupStopsByVisit(route.stops)) {
        const first = group[0];
        const key = visitKeyOfStop(first);

        // La visita ya está completa para este mes (todos sus equipos en la misma OT) -> se omite.
        const generatedOts = new Set(
          group
            .filter((s) => s.generatedMonth === month)
            .map((s) => s.generatedWorkOrderId)
        );
        if (
          group.every((s) => s.generatedMonth === month) &&
          generatedOts.size === 1 &&
          !generatedOts.has(null)
        ) {
          skipped += group.length;
          continue;
        }

        // Cualquier equipo con contrato caído invalida la visita completa.
        const inactive = group.filter((s) => isContractInactive(s));
        if (inactive.length > 0) {
          errors.push({
            stopId: first.id,
            visitGroupId: first.visitGroupId,
            businessDayNumber: route.businessDayNumber,
            costCenterName: first.costCenterName,
            equipmentCount: group.length,
            message: inactive.some((s) => s.contractDeletedAt !== null)
              ? "Contrato eliminado"
              : "Contrato inactivo",
          });
          continue;
        }

        // Todos los equipos de una visita comparten la misma hora programada.
        const times = new Set(group.map((s) => s.plannedTime));
        if (times.size > 1) {
          errors.push({
            stopId: first.id,
            visitGroupId: first.visitGroupId,
            businessDayNumber: route.businessDayNumber,
            costCenterName: first.costCenterName,
            equipmentCount: group.length,
            message: "La visita tiene horas distintas entre equipos",
          });
          continue;
        }

        pendingGroups.push({ key, stops: group, day: route.businessDayNumber, date });
      }
    }

    // Visitas generadas parcialmente: libera la OT previa para no dejar OTs incompletas.
    // Solo se liberan OTs del mes que se está regenerando; las de meses anteriores
    // se conservan y su vínculo simplemente se sobrescribe.
    const releasable: Array<{ group: (typeof pendingGroups)[number]; orphanIds: string[] }> = [];
    for (const group of pendingGroups) {
      const orphanIds = [
        ...new Set(
          group.stops
            .filter((s) => s.generatedMonth === month)
            .map((s) => s.generatedWorkOrderId)
            .filter((id): id is string => id !== null)
        ),
      ];
      if (orphanIds.length > 0) releasable.push({ group, orphanIds });
    }

    for (const { group, orphanIds } of releasable) {
      for (const otId of orphanIds) {
        const rows = await db
          .select({
            status: workOrders.status,
            startedAt: workOrders.startedAt,
            completedAt: workOrders.completedAt,
            otNumber: workOrders.otNumber,
          })
          .from(workOrders)
          .where(eq(workOrders.id, otId))
          .limit(1);
        const ot = rows[0];
        if (!ot) continue;
        if (ot.status !== "PENDING" || ot.startedAt || ot.completedAt) {
          errors.push({
            stopId: group.stops[0].id,
            visitGroupId: group.stops[0].visitGroupId,
            businessDayNumber: group.day,
            costCenterName: group.stops[0].costCenterName,
            equipmentCount: group.stops.length,
            message: `${ot.otNumber} ya tiene ejecución registrada; regenérala manualmente`,
          });
          continue;
        }
        // Hard delete: la FK generated_work_order_id (ON DELETE SET NULL) libera los stops.
        await db.delete(workOrders).where(eq(workOrders.id, otId));
        for (const stop of group.stops) {
          if (stop.generatedWorkOrderId !== otId) continue;
          await db
            .update(preventiveRouteStops)
            .set({ generatedWorkOrderId: null })
            .where(eq(preventiveRouteStops.id, stop.id));
        }
      }
    }

    // Una visita parcialmente generada que quedó con error no se genera.
    const failedStopIds = new Set(errors.map((e) => e.stopId));
    const readyGroups = pendingGroups.filter(
      (g) => !failedStopIds.has(g.stops[0].id)
    );

    if (readyGroups.length === 0) {
      revalidatePath("/routes");
      return { success: true, month, created: 0, skipped, errors };
    }

    // Secuencia por mes basada en el sufijo más alto existente (no en COUNT:
    // si se liberan OTs, COUNT repetiría números).
    const existingNumbers = await db
      .select({ otNumber: workOrders.otNumber })
      .from(workOrders)
      .where(like(workOrders.otNumber, `OT-${month}-%`));
    let seq =
      existingNumbers.reduce((max, row) => {
        const match = /(\d+)$/.exec(row.otNumber);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0) + 1;

    const now = Math.floor(Date.now() / 1000);
    const stmts: BatchItem<"sqlite">[] = [];
    let created = 0;

    for (const group of readyGroups) {
      const first = group.stops[0];
      const [hh, mm] = first.plannedTime.split(":").map(Number);
      const scheduledTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      const woId = generateUuid();

      // 1 visita = 1 OT
      stmts.push(
        db.insert(workOrders).values({
          id: woId,
          otNumber: `OT-${month}-${String(seq).padStart(4, "0")}`,
          costCenterId: first.costCenterId,
          technicianId,
          serviceTypeId: prevServiceTypeId,
          type: prevServiceTypeId,
          status: "PENDING",
          priority: "NORMAL",
          scheduledDate: group.date,
          scheduledTime,
        })
      );

      // N work_order_elevators + vínculo de cada stop
      for (const stop of group.stops) {
        stmts.push(
          db.insert(workOrderElevators).values({
            id: generateUuid(),
            workOrderId: woId,
            elevatorUnityId: stop.elevatorUnityId,
            status: "PENDING",
          }),
          db
            .update(preventiveRouteStops)
            .set({
              generatedWorkOrderId: woId,
              generatedMonth: month,
              generatedAt: now,
            })
            .where(eq(preventiveRouteStops.id, stop.id))
        );
      }

      seq++;
      created++;
    }

    await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]);

    revalidatePath("/routes");
    revalidatePath("/work-orders");

    return { success: true, month, created, skipped, errors };
  } catch (error) {
    console.error("Error al generar OTs del mes:", error);
    return { ...empty, error: getErrorMessage(error) };
  }
}