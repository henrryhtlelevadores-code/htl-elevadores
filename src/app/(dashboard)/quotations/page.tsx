import { getQuotations, getQuotationFormData, getLaborConfig } from "@/features/quotations/actions";
import { QuotationsTable } from "@/features/quotations/components/quotations-table";
import { FileText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function QuotationsPage() {
  const [quotations, options, hourlyCost] = await Promise.all([
    getQuotations(),
    getQuotationFormData(),
    getLaborConfig(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="size-5 text-[#0066CC]" />
            Cotizaciones
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Elaboración de cotizaciones para servicios de mantenimiento y reparación de equipos de
            elevación, con descarga de PDF y disponibilidad en el portal del cliente.
          </p>
        </div>
      </div>

      <QuotationsTable
        initialQuotations={quotations}
        options={options}
        defaultHourlyCost={hourlyCost}
      />
    </div>
  );
}