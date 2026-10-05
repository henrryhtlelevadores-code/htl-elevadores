import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getTechnicianContext,
  getTechnicianWorkOrderExecution,
} from "@/features/technician/server/queries";
import { TechnicianExecutionView } from "@/features/technician/components/execution";
import { remainingUntilLabel } from "@/features/technician/lib/dates";

export const dynamic = "force-dynamic";

export default async function TechnicianWorkOrderExecutionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getTechnicianContext();
  if (!context) return null; // el layout redirige a /login

  const execution = await getTechnicianWorkOrderExecution(context.userId, id);
  if (!execution) notFound();

  const isEmergency =
    execution.serviceType?.category === "EMERGENCIA" ||
    Boolean(execution.serviceType?.code?.toUpperCase().startsWith("EMER"));
  const slaRemainingLabel = isEmergency
    ? remainingUntilLabel(execution.scheduledDate, execution.scheduledTime)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          render={<Link href="/technician/work-orders" />}
          variant="ghost"
          size="sm"
          nativeButton={false}
          className="min-h-[44px] -ml-2"
        >
          <ChevronLeft className="size-4" />
          Mis órdenes
        </Button>
      </div>
      <TechnicianExecutionView
        workOrder={execution}
        slaRemainingLabel={slaRemainingLabel}
      />
    </div>
  );
}
