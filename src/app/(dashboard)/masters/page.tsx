import { getBrands, getElevatorTypes, getModels, getServiceTypes, getUbigeos } from "@/features/masters/actions";
import { MastersView } from "@/features/masters/components/masters-view";

export const dynamic = "force-dynamic";

export default async function MastersPage() {
  const [brandsData, typesData, modelsData, serviceTypesData, ubigeosData] = await Promise.all([
    getBrands(),
    getElevatorTypes(),
    getModels(),
    getServiceTypes(),
    getUbigeos(),
  ]);

  return (
    <div className="space-y-6">
      <MastersView
        brands={brandsData}
        types={typesData}
        models={modelsData}
        serviceTypes={serviceTypesData}
        ubigeos={ubigeosData}
      />
    </div>
  );
}