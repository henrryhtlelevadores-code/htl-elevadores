import { getSafetyTemplates } from "@/features/safety/actions";
import { SafetyTemplatesTable } from "@/features/safety/components/safety-templates-table";
import { getElevatorTypes } from "@/features/masters/actions";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SafetyPage() {
  const [templates, elevatorTypes] = await Promise.all([getSafetyTemplates(), getElevatorTypes()]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="size-5 text-[#0066CC]" />
            Plantillas de Seguridad
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Checklists y protocolos empleados en las órdenes de trabajo.
          </p>
        </div>
      </div>

      <SafetyTemplatesTable initialTemplates={templates} elevatorTypes={elevatorTypes} />
    </div>
  );
}