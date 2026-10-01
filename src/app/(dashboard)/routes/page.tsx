import {
  getTechnicians,
  getPreventiveRoutes,
  getPreventiveContractOptions,
  getPreventiveContractCoverage,
  getRouteConfig,
} from "@/features/routes/actions";
import { RoutesBoard } from "@/features/routes/components/routes-board";

export const dynamic = "force-dynamic";

export default async function RoutesPage() {
  const [technicians, contractOptions, coverage] = await Promise.all([
    getTechnicians(),
    getPreventiveContractOptions(),
    getPreventiveContractCoverage(),
  ]);

  const technicianId = technicians[0]?.id ?? "";
  const [defaultRoutes, defaultConfig] = await Promise.all([
    technicianId ? getPreventiveRoutes(technicianId) : Promise.resolve([]),
    getRouteConfig(technicianId),
  ]);

  return (
    <RoutesBoard
      technicians={technicians}
      contractOptions={contractOptions}
      defaultRoutes={defaultRoutes}
      defaultConfig={defaultConfig}
      defaultCoverage={coverage}
    />
  );
}
