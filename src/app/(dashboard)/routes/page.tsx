import { getTechnicians, getPreventiveRoutes, getPreventiveContractOptions } from "@/features/routes/actions";
import { RoutesBoard } from "@/features/routes/components/routes-board";

export const dynamic = "force-dynamic";

export default async function RoutesPage() {
  const [technicians, contractOptions] = await Promise.all([
    getTechnicians(),
    getPreventiveContractOptions(),
  ]);

  const firstTechnicianId = technicians[0]?.id ?? "";
  const defaultRoutes = firstTechnicianId
    ? await getPreventiveRoutes(firstTechnicianId)
    : [];

  return (
    <RoutesBoard
      technicians={technicians}
      contractOptions={contractOptions}
      defaultRoutes={defaultRoutes}
    />
  );
}