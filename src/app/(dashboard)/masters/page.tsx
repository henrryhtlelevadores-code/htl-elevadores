import { getBrands, getElevatorTypes, getModels, getServiceTypes, getUbigeos, getMaintenanceZones, getMaintenanceElevatorTypes, getSuppliers } from "@/features/masters/actions";
import { MastersView } from "@/features/masters/components/masters-view";
import { requirePageAccess } from "@/features/auth/guard";

export const dynamic = "force-dynamic";

export default async function MastersPage() {
  await requirePageAccess("masters:read");
  const [brandsData, typesData, modelsData, serviceTypesData, ubigeosData, maintenanceZonesData, maintenanceTypesData, suppliersData] = await Promise.all([
    getBrands(),
    getElevatorTypes(),
    getModels(),
    getServiceTypes(),
    getUbigeos(),
    getMaintenanceZones(),
    getMaintenanceElevatorTypes(),
    getSuppliers(),
  ]);

  return (
    <div className="space-y-6">
      <MastersView
        brands={brandsData}
        types={typesData}
        models={modelsData}
        serviceTypes={serviceTypesData}
        ubigeos={ubigeosData}
        maintenanceZones={maintenanceZonesData}
        maintenanceTypes={maintenanceTypesData}
        suppliers={suppliersData}
      />
    </div>
  );
}
