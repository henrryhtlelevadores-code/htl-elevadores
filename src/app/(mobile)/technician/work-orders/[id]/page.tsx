import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getTechnicianContext,
  getTechnicianWorkOrderExecution,
} from "@/features/technician/queries";
import { TechnicianExecutionView } from "@/features/technician/components/execution";

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
      <TechnicianExecutionView workOrder={execution} />
    </div>
  );
}