import { getInvoices, getInvoicesFilterData, getInvoiceFormData } from "@/features/invoices/actions";
import { InvoicesView } from "@/features/invoices/components/invoices-view";
import { ReceiptText } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const [invoices, filterData, formData] = await Promise.all([
    getInvoices(),
    getInvoicesFilterData(),
    getInvoiceFormData(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <ReceiptText className="size-5 text-[#0066CC]" />
            Facturas
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Comprobantes emitidos, estados SUNAT y estado de pago por cliente.
          </p>
        </div>
      </div>

      <InvoicesView
        invoices={invoices}
        clients={filterData.clients}
        costCenters={filterData.costCenters}
        formData={formData}
      />
    </div>
  );
}