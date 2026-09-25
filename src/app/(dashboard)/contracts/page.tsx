import { getContracts, getContractElevators, getContractCostCenters, getContractServiceTypes } from "@/features/contracts/actions";
import { ContractsTable } from "@/features/contracts/components/contracts-table";
import { getClients } from "@/features/clients/actions";
import { getEquipmentList } from "@/features/equipment/actions";
import { FileSignature } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const [contracts, contractElevators, costCenters, serviceTypes, clients, equipment] = await Promise.all([
    getContracts(),
    getContractElevators(),
    getContractCostCenters(),
    getContractServiceTypes(),
    getClients(),
    getEquipmentList(),
  ]);

  const equipmentOptions = equipment
    .map((e) => ({
      id: e.id,
      costCenterId: e.costCenterId,
      internalCode: e.internalCode,
      name: e.name,
      manufacturerSerial: e.manufacturerSerial,
      brand_name: e.brand_name ?? null,
      model_name: e.model_name ?? null,
      elevator_type_name: e.elevator_type_name ?? null,
      cost_center_name: e.cost_center_name ?? null,
      client_name: e.client_name ?? null,
      capacityPersons: e.capacityPersons,
      capacityKg: e.capacityKg,
      speedMs: e.speedMs,
      stops: e.stops,
      floors: e.floors,
      tractionType: e.tractionType,
      yearOfFabrication: e.yearOfFabrication,
      status: e.status,
      installationDate: e.installationDate,
    }))
    .filter((e) => {
      const assignedToActive = contractElevators.some(
        (ce) =>
          ce.elevatorUnityId === e.id &&
          contracts.some(
            (c) =>
              c.id === ce.contractId &&
              c.deletedAt == null &&
              c.status !== "CANCELLED" &&
              c.status !== "EXPIRED"
          )
      );
      return !assignedToActive;
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileSignature className="size-5 text-[#0066CC]" />
            Contratos
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Administración de contratos de mantenimiento y sus unidades asociadas.
          </p>
        </div>
      </div>

      <ContractsTable
        initialContracts={contracts}
        clients={clients}
        costCenters={costCenters}
        serviceTypes={serviceTypes}
        initialContractElevators={contractElevators}
        equipmentOptions={equipmentOptions}
      />
    </div>
  );
}