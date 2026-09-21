import {
  getTechnicianContext,
  getTechnicianWorkOrders,
} from "@/features/technician/queries";
import { TechnicianWorkOrderList } from "@/features/technician/components/list";

export const dynamic = "force-dynamic";

export default async function TechnicianWorkOrdersPage() {
  const context = await getTechnicianContext();
  const workOrders = context ? await getTechnicianWorkOrders(context.userId) : [];

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Mis órdenes de trabajo</h1>
      <TechnicianWorkOrderList
        technicianName={context?.fullName.split(" ")[0] ?? ""}
        workOrders={workOrders}
      />
    </div>
  );
}