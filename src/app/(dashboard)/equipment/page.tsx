import { getEquipmentList, getEquipmentFormData } from "@/features/equipment/actions";
import { EquipmentTable } from "@/features/equipment/components/equipment-table";
import { Cpu } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const [equipment, formData] = await Promise.all([getEquipmentList(), getEquipmentFormData()]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Cpu className="size-5 text-[#0066CC]" />
            Equipos de Elevación
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Inventario de unidades de transporte vertical con especificaciones técnicas.
          </p>
        </div>
      </div>

      <EquipmentTable initialEquipment={equipment} formData={formData} />
    </div>
  );
}