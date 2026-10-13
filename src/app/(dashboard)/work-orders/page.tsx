import {
  getWorkOrders,
  getWorkOrdersFormData,
  getWorkOrderElevators,
} from "@/features/work-orders/actions";
import { getWorkOrderServices } from "@/features/work-orders/services-actions";
import { WorkOrdersCalendar } from "@/features/work-orders/components/work-orders-calendar";
import { ClipboardList } from "lucide-react";
import { requirePageAccess } from "@/features/auth/guard";

export const dynamic = "force-dynamic";

export default async function WorkOrdersPage() {
  await requirePageAccess("work_orders:panel:read");
  const [workOrders, formData, workOrderElevators, workOrderServices] = await Promise.all([
    getWorkOrders(),
    getWorkOrdersFormData(),
    getWorkOrderElevators(),
    getWorkOrderServices(),
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
            Programación de mantenimientos, atención técnica, servicios generales y checklists de campo.
          </p>
        </div>
      </div>

      <WorkOrdersCalendar
        initialWorkOrders={workOrders}
        formData={formData}
        initialWorkOrderElevators={workOrderElevators}
        initialWorkOrderServices={workOrderServices}
      />
    </div>
  );
}