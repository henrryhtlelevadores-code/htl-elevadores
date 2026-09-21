"use server";

import { revalidatePath } from "next/cache";
import {
  db,
  contracts,
  clients,
  costCenters,
  serviceTypes,
  elevatorUnities,
  contractElevators,
  brands,
  type Contract,
  type ContractElevator,
} from "@/db/index";
import { getErrorMessage } from "@/lib/errors";
import { generateUuid } from "@/lib/uuid";
import {
  contractFormSchema,
  contractElevatorFormSchema,
  type ContractFormValues,
  type ContractElevatorFormValues,
} from "./schema";
import { eq, asc, desc, isNull, and, like, count } from "drizzle-orm";

export type ContractWithRelations = Contract & {
  cost_center_name?: string | null;
  service_type_name?: string | null;
};

const toUnix = (iso: string): number => Math.floor(new Date(iso).getTime() / 1000);

function buildContractNumber(currSeq: number): string {
  const year = new Date().getFullYear();
  return `CT-${year}-${String(currSeq).padStart(4, "0")}`;
}

async function nextContractNumber(): Promise<string> {
  try {
    const year = new Date().getFullYear();
    const [{ total }] = await db
      .select({ total: count() })
      .from(contracts)
      .where(and(isNull(contracts.deletedAt), like(contracts.contractNumber, `CT-${year}-%`)));
    return buildContractNumber(total + 1);
  } catch (error) {
    console.error("Error al generar número de contrato:", error);
    return buildContractNumber(1);
  }
}

export async function getContracts(): Promise<ContractWithRelations[]> {
  try {
    return await db
      .select({
        id: contracts.id,
        contractNumber: contracts.contractNumber,
        costCenterId: contracts.costCenterId,
        status: contracts.status,
        serviceTypeId: contracts.serviceTypeId,
        startDate: contracts.startDate,
        endDate: contracts.endDate,
        autoRenewal: contracts.autoRenewal,
        noticePeriodDays: contracts.noticePeriodDays,
        currency: contracts.currency,
        baseAmount: contracts.baseAmount,
        includesIgv: contracts.includesIgv,
        paymentTermsDays: contracts.paymentTermsDays,
        inflationAdjustment: contracts.inflationAdjustment,
        slaEntrapmentMins: contracts.slaEntrapmentMins,
        slaMechanicalFailureMins: contracts.slaMechanicalFailureMins,
        clientSignerName: contracts.clientSignerName,
        clientSignerDocument: contracts.clientSignerDocument,
        signatureDate: contracts.signatureDate,
        documentStatus: contracts.documentStatus,
        documentOverrides: contracts.documentOverrides,
        finalPdfUrl: contracts.finalPdfUrl,
        createdAt: contracts.createdAt,
        deletedAt: contracts.deletedAt,
        cost_center_name: costCenters.name,
        service_type_name: serviceTypes.name,
      })
      .from(contracts)
      .innerJoin(costCenters, eq(contracts.costCenterId, costCenters.id))
      .innerJoin(serviceTypes, eq(contracts.serviceTypeId, serviceTypes.id))
      .where(isNull(contracts.deletedAt))
      .orderBy(desc(contracts.createdAt));
  } catch (error) {
    console.error("Error al obtener contratos:", error);
    return [];
  }
}

export async function createContract(data: ContractFormValues) {
  try {
    const validated = contractFormSchema.parse(data);
    const contractNumber = await nextContractNumber();

    await db.insert(contracts).values({
      id: generateUuid(),
      contractNumber,
      costCenterId: validated.costCenterId,
      status: validated.status || "ACTIVE",
      serviceTypeId: validated.serviceTypeId,
      startDate: toUnix(validated.startDate),
      endDate: validated.endDate ? toUnix(validated.endDate) : null,
      autoRenewal: validated.autoRenewal,
      noticePeriodDays: validated.noticePeriodDays ?? 30,
      currency: validated.currency || "PEN",
      baseAmount: validated.baseAmount,
      includesIgv: validated.includesIgv,
      paymentTermsDays: validated.paymentTermsDays ?? 5,
      inflationAdjustment: validated.inflationAdjustment,
      slaEntrapmentMins: validated.slaEntrapmentMins ?? 45,
      slaMechanicalFailureMins: validated.slaMechanicalFailureMins ?? 180,
    });

    revalidatePath("/contracts");
    return { success: true, message: `Contrato ${contractNumber} registrado correctamente` };
  } catch (error) {
    console.error("Error al crear contrato:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateContract(id: string, data: Partial<ContractFormValues>) {
  try {
    const updateData: {
      costCenterId?: string;
      status?: string;
      serviceTypeId?: string;
      startDate?: number;
      endDate?: number | null;
      autoRenewal?: boolean;
      noticePeriodDays?: number;
      currency?: string;
      baseAmount?: number;
      includesIgv?: boolean;
      paymentTermsDays?: number;
      inflationAdjustment?: boolean;
      slaEntrapmentMins?: number;
      slaMechanicalFailureMins?: number;
    } = {};
    if (data.costCenterId) updateData.costCenterId = data.costCenterId;
    if (data.status) updateData.status = data.status;
    if (data.serviceTypeId) updateData.serviceTypeId = data.serviceTypeId;
    if (data.startDate) updateData.startDate = toUnix(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? toUnix(data.endDate) : null;
    if (data.autoRenewal !== undefined) updateData.autoRenewal = data.autoRenewal;
    if (data.noticePeriodDays !== undefined) updateData.noticePeriodDays = data.noticePeriodDays;
    if (data.currency) updateData.currency = data.currency;
    if (data.baseAmount !== undefined) updateData.baseAmount = data.baseAmount;
    if (data.includesIgv !== undefined) updateData.includesIgv = data.includesIgv;
    if (data.paymentTermsDays !== undefined) updateData.paymentTermsDays = data.paymentTermsDays;
    if (data.inflationAdjustment !== undefined)
      updateData.inflationAdjustment = data.inflationAdjustment;
    if (data.slaEntrapmentMins !== undefined) updateData.slaEntrapmentMins = data.slaEntrapmentMins;
    if (data.slaMechanicalFailureMins !== undefined)
      updateData.slaMechanicalFailureMins = data.slaMechanicalFailureMins;

    await db.update(contracts).set(updateData).where(eq(contracts.id, id));

    revalidatePath("/contracts");
    return { success: true, message: "Contrato actualizado exitosamente" };
  } catch (error) {
    console.error("Error al actualizar contrato:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteContract(id: string) {
  try {
    await db.update(contracts).set({ deletedAt: Math.floor(Date.now() / 1000) }).where(eq(contracts.id, id));
    revalidatePath("/contracts");
    return { success: true, message: "Contrato eliminado correctamente" };
  } catch (error) {
    console.error("Error al eliminar contrato:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// 2. EQUIPOS DEL CONTRATO (CONTRACT ELEVATORS)
// ==========================================

export type ContractElevatorWithRelations = ContractElevator & {
  internal_code?: string | null;
  elevator_name?: string | null;
  cost_center_name?: string | null;
  brand_name?: string | null;
};

export async function getContractElevators(
  contractId?: string
): Promise<ContractElevatorWithRelations[]> {
  try {
    const query = db
      .select({
        id: contractElevators.id,
        contractId: contractElevators.contractId,
        elevatorUnityId: contractElevators.elevatorUnityId,
        frequencyMonths: contractElevators.frequencyMonths,
        price: contractElevators.price,
        addedAt: contractElevators.addedAt,
        internal_code: elevatorUnities.internalCode,
        elevator_name: elevatorUnities.name,
        cost_center_name: costCenters.name,
        brand_name: brands.name,
      })
      .from(contractElevators)
      .innerJoin(elevatorUnities, eq(contractElevators.elevatorUnityId, elevatorUnities.id))
      .innerJoin(costCenters, eq(elevatorUnities.costCenterId, costCenters.id))
      .leftJoin(brands, eq(elevatorUnities.brandId, brands.id))
      .orderBy(asc(elevatorUnities.internalCode));

    if (contractId) {
      return await query.where(eq(contractElevators.contractId, contractId));
    }
    return await query;
  } catch (error) {
    console.error("Error al obtener equipos del contrato:", error);
    return [];
  }
}

export async function createContractElevator(data: ContractElevatorFormValues) {
  try {
    const validated = contractElevatorFormSchema.parse(data);

    await db.insert(contractElevators).values({
      id: generateUuid(),
      contractId: validated.contractId,
      elevatorUnityId: validated.elevatorUnityId,
      frequencyMonths: validated.frequencyMonths || 1,
      price: validated.price,
    });

    revalidatePath("/contracts");
    return { success: true, message: "Equipo asignado al contrato" };
  } catch (error) {
    console.error("Error al asignar equipo al contrato:", error);
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return { success: false, error: "El equipo ya está asignado a este contrato." };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateContractElevator(
  id: string,
  data: Partial<ContractElevatorFormValues>
) {
  try {
    const updateData: { frequencyMonths?: number; price?: number } = {};
    if (data.frequencyMonths !== undefined) updateData.frequencyMonths = data.frequencyMonths;
    if (data.price !== undefined) updateData.price = data.price;

    await db.update(contractElevators).set(updateData).where(eq(contractElevators.id, id));

    revalidatePath("/contracts");
    return { success: true, message: "Equipo del contrato actualizado" };
  } catch (error) {
    console.error("Error al actualizar equipo del contrato:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteContractElevator(id: string) {
  try {
    await db.delete(contractElevators).where(eq(contractElevators.id, id));
    revalidatePath("/contracts");
    return { success: true, message: "Equipo eliminado del contrato" };
  } catch (error) {
    console.error("Error al eliminar equipo del contrato:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// 3. CENTROS DE COSTO PARA EL FORMULARIO
// ==========================================

export async function getContractCostCenters() {
  try {
    const result = await db
      .select({
        id: costCenters.id,
        clientId: costCenters.clientId,
        name: costCenters.name,
        address: costCenters.address,
        client_name: clients.legalName,
      })
      .from(costCenters)
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .where(isNull(costCenters.deletedAt))
      .orderBy(asc(costCenters.name));
    return result;
  } catch (error) {
    console.error("Error al obtener centros de costo:", error);
    return [];
  }
}

export async function getContractServiceTypes() {
  try {
    return await db
      .select()
      .from(serviceTypes)
      .where(eq(serviceTypes.isActive, true))
      .orderBy(asc(serviceTypes.name));
  } catch (error) {
    console.error("Error al obtener tipos de servicio:", error);
    return [];
  }
}

// ==========================================
// 4. DETALLE DEL CONTRATO
// ==========================================

export type ContractDetail = Contract & {
  cost_center_name: string | null;
  cost_center_address: string | null;
  cost_center_district: string | null;
  service_type_name: string | null;
  client_legal_name: string | null;
  elevators: ContractElevatorWithRelations[];
};

export async function getContractById(id: string): Promise<ContractDetail | null> {
  try {
    const [row] = await db
      .select({
        id: contracts.id,
        contractNumber: contracts.contractNumber,
        costCenterId: contracts.costCenterId,
        status: contracts.status,
        serviceTypeId: contracts.serviceTypeId,
        startDate: contracts.startDate,
        endDate: contracts.endDate,
        autoRenewal: contracts.autoRenewal,
        noticePeriodDays: contracts.noticePeriodDays,
        currency: contracts.currency,
        baseAmount: contracts.baseAmount,
        includesIgv: contracts.includesIgv,
        paymentTermsDays: contracts.paymentTermsDays,
        inflationAdjustment: contracts.inflationAdjustment,
        slaEntrapmentMins: contracts.slaEntrapmentMins,
        slaMechanicalFailureMins: contracts.slaMechanicalFailureMins,
        clientSignerName: contracts.clientSignerName,
        clientSignerDocument: contracts.clientSignerDocument,
        signatureDate: contracts.signatureDate,
        documentStatus: contracts.documentStatus,
        documentOverrides: contracts.documentOverrides,
        finalPdfUrl: contracts.finalPdfUrl,
        createdAt: contracts.createdAt,
        deletedAt: contracts.deletedAt,
        cost_center_name: costCenters.name,
        cost_center_address: costCenters.address,
        cost_center_district: costCenters.district,
        service_type_name: serviceTypes.name,
        client_legal_name: clients.legalName,
      })
      .from(contracts)
      .innerJoin(costCenters, eq(contracts.costCenterId, costCenters.id))
      .innerJoin(serviceTypes, eq(contracts.serviceTypeId, serviceTypes.id))
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .where(eq(contracts.id, id))
      .limit(1);

    if (!row) return null;

    const elevators = await getContractElevators(id);

    return { ...row, elevators };
  } catch (error) {
    console.error("Error al obtener contrato:", error);
    return null;
  }
}

export async function updateContractDocument(
  id: string,
  data: {
    clientSignerName?: string;
    clientSignerDocument?: string;
    signatureDate?: number;
    documentOverrides?: Record<string, unknown>;
  }
) {
  try {
    const updateData: Record<string, unknown> = {};
    if (data.clientSignerName !== undefined) updateData.clientSignerName = data.clientSignerName;
    if (data.clientSignerDocument !== undefined) updateData.clientSignerDocument = data.clientSignerDocument;
    if (data.signatureDate !== undefined) updateData.signatureDate = data.signatureDate;
    if (data.documentOverrides !== undefined) {
      updateData.documentOverrides = data.documentOverrides;
    }

    await db.update(contracts).set(updateData).where(eq(contracts.id, id));

    revalidatePath("/contracts");
    revalidatePath(`/contracts/${id}`);
    return { success: true, message: "Documento actualizado" };
  } catch (error) {
    console.error("Error al actualizar documento:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}