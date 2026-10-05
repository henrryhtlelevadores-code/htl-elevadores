import {
  getTechnicianContext,
  getTechnicianWorkOrders,
  getTechnicianEmergencies,
} from "@/features/technician/server/queries";
import { TechnicianView } from "@/features/technician/components/technician-view";

export const dynamic = "force-dynamic";

export default async function TechnicianWorkOrdersPage() {
  const context = await getTechnicianContext();
  const workOrders = context ? await getTechnicianWorkOrders(context.userId) : [];
  const emergencies = context ? await getTechnicianEmergencies(context.userId) : [];

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Mis órdenes de trabajo</h1>
      <TechnicianView
        workOrders={workOrders}
        emergencies={emergencies}
        technicianName={context?.fullName.split(" ")[0] ?? ""}
      />
    </div>
  );
}
