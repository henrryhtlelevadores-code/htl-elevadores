import { getCompletedWorkOrders, getReportsFilterData } from "@/features/reports/actions";
import { InformesView } from "@/features/reports/components/informes-view";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [workOrders, filterData] = await Promise.all([
    getCompletedWorkOrders(),
    getReportsFilterData(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="size-5 text-[#0066CC]" />
            Informes
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Órdenes de trabajo completadas: revisión de información, evidencias y
            observaciones.
          </p>
        </div>
      </div>

      <InformesView
        workOrders={workOrders}
        clients={filterData.clients}
        costCenters={filterData.costCenters}
      />
    </div>
  );
}