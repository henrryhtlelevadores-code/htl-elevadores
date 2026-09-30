import { getMaintenanceModules, getMaintenanceElevatorTypes } from "@/features/maintenance/actions";
import { MaintenanceModulesTable } from "@/features/maintenance/components/maintenance-modules-table";
import { Wrench } from "lucide-react";
import { getClients } from "@/features/clients/actions";
import { getContracts, getContractCostCenters, getContractElevators } from "@/features/contracts/actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Módulos de Mantenimiento | HTL Elevadores",
};

export default async function MaintenanceModulesPage() {
  const [modules, elevatorTypes, clients, costCenters, contracts, elevators] = await Promise.all([
    getMaintenanceModules(),
    getMaintenanceElevatorTypes(),
    getClients(),
    getContractCostCenters(),
    getContracts(),
    getContractElevators(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wrench className="size-5 text-[#0066CC]" />
            Módulos de Mantenimiento
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Catálogo de módulos (M1..M8) y sus tareas de inspección por zona.
          </p>
        </div>
      </div>

       <MaintenanceModulesTable initialModules={modules} elevatorTypes={elevatorTypes} clients={clients} costCenters={costCenters} contracts={contracts} elevators={elevators} />
    </div>
  );
}
