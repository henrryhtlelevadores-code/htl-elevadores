import {
  getWorkOrders,
  getWorkOrdersFormData,
  getWorkOrderElevators,
} from "@/features/work-orders/actions";
import { WorkOrdersCalendar } from "@/features/work-orders/components/work-orders-calendar";
import { ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkOrdersPage() {
  const [workOrders, formData, workOrderElevators] = await Promise.all([
    getWorkOrders(),
    getWorkOrdersFormData(),
    getWorkOrderElevators(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClipboardList className="size-5 text-[#0066CC]" />
            Órdenes de Trabajo
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Programación de mantenimientos, atención técnica y checklists de campo.
          </p>
        </div>
      </div>

      <WorkOrdersCalendar
        initialWorkOrders={workOrders}
        formData={formData}
        initialWorkOrderElevators={workOrderElevators}
      />
    </div>
  );
}