"use client";

import { useEffect, useMemo } from "react";
import { useSubmitTransition } from "@/lib/use-submit-transition";
import { useProgressRouter } from "@/lib/navigation-progress";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  quotationHeaderSchema,
  QUOTATION_STATUS,
  type QuotationHeaderValues,
} from "../schema";
import { createQuotation, updateQuotationHeader } from "../actions";
import type { QuotationDetail, QuotationFormOptions } from "../actions";
import { plusDays, SectionTitle, todayInput, tsToInput } from "./quotation-form-shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Loader2, ReceiptText } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";

interface QuotationCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  editingDetail: QuotationDetail | null;
  options: QuotationFormOptions;
  currentUser: { id: string; fullName: string | null } | null;
}

function defaultValues(currentUserId: string | null): QuotationHeaderValues {
  return {
    clientId: "",
    costCenterId: "",
    advisorId: currentUserId ?? "",
    issueDate: todayInput(),
    validUntil: plusDays(30),
    status: "DRAFT",
  };
}

function detailToValues(detail: QuotationDetail): QuotationHeaderValues {
  return {
    clientId: detail.clientId,
    costCenterId: detail.costCenterId ?? "",
    advisorId: detail.advisorId ?? "",
    issueDate: tsToInput(detail.issueDate),
    validUntil: tsToInput(detail.validUntil),
    status: detail.status ?? "DRAFT",
  };
}

/**
 * Popup de datos generales (cliente, sede, asesor, fechas). Crea la cotización
 * vacía y lleva a su detalle, donde se cargan las líneas y los descuentos.
 */
export function QuotationCreateDialog({
  open,
  onOpenChange,
  onSaved,
  editingDetail,
  options,
  currentUser,
}: QuotationCreateDialogProps) {
  const currentUserId = currentUser?.id ?? null;
  const [isPending, startTransition] = useSubmitTransition();
  const router = useProgressRouter();

  const form = useForm<QuotationHeaderValues>({
    resolver: zodResolver(quotationHeaderSchema),
    defaultValues: defaultValues(currentUserId),
  });

  const clientId = useWatch({ control: form.control, name: "clientId" });

  const filteredCostCenters = useMemo(
    () =>
      clientId
        ? options.costCenters.filter((cc) => cc.clientId === clientId)
        : [],
    [clientId, options.costCenters]
  );

  useEffect(() => {
    if (open) {
      form.reset(editingDetail ? detailToValues(editingDetail) : defaultValues(currentUserId));
      form.clearErrors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingDetail]);

  function handleClose() {
    if (isPending) return;
    form.reset();
    onOpenChange(false);
  }

  function handleSubmit(values: QuotationHeaderValues) {
    startTransition(async () => {
      const res = editingDetail
        ? await updateQuotationHeader(editingDetail.id, values)
        : await createQuotation({
            ...values,
            discountMode: "PERCENT",
            discountRate: "0",
            discountAmount: "0",
            targetTotal: "",
            targetTotalIncludesIgv: true,
            showTaxBreakdown: true,
            lines: [],
          });
      if (res.success) {
        toast.success(editingDetail ? "Cotización actualizada" : "Cotización creada", {
          description: editingDetail
            ? res.message
            : "Agrega ahora los equipos y servicios en Líneas de Cotización.",
        });
        form.reset();
        onOpenChange(false);
        onSaved?.();
        if (!editingDetail && res.id) router.push(`/quotations/${res.id}`);
      } else {
        toast.error("Error al guardar", { description: res.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="bg-card border-border sm:max-w-[760px] text-foreground shadow-lg max-h-[94dvh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <FileText className="size-4 text-[#0066CC]" />
            {editingDetail
              ? `Editar cotización ${editingDetail.quotationNumber}`
              : "Nueva cotización"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {editingDetail
              ? "Datos generales de la cotización. Las líneas y los descuentos se editan en su detalle."
              : "Registra los datos generales. Al crearla pasarás a su detalle para agregar las líneas."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 pt-2">
            <div className="space-y-3">
              <SectionTitle icon={ReceiptText} title="Cliente y referencia" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Cliente</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          items={options.clients}
                          value={field.value ?? ""}
                          onValueChange={(v) => {
                            field.onChange(v);
                            form.setValue("costCenterId", "");
                          }}
                          getValue={(c) => c.id}
                          getLabel={(c) => c.legalName ?? "Sin nombre"}
                          getKeywords={(c) => c.taxId}
                          placeholder="Selecciona un cliente"
                          searchPlaceholder="Buscar cliente..."
                          emptyText="No hay clientes registrados"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="costCenterId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Sede</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          items={filteredCostCenters}
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                          getValue={(cc) => cc.id}
                          getLabel={(cc) => cc.name ?? "Sin nombre"}
                          getKeywords={(cc) => cc.address}
                          placeholder={
                            clientId ? "Selecciona una sede" : "Elige un cliente primero"
                          }
                          searchPlaceholder="Buscar sede..."
                          emptyText="Este cliente no tiene sedes"
                          disabled={!clientId}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="advisorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Asesor</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full bg-background border-border text-xs">
                            <SelectValue placeholder="Opcional" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.advisors.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="issueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Fecha de emisión</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value ?? ""}
                          onChange={(v) => field.onChange(v)}
                          className="text-xs"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="validUntil"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Válida hasta</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value ?? ""}
                          onChange={(v) => field.onChange(v)}
                          className="text-xs"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Estado</FormLabel>
                       <FormControl>
                         {editingDetail ? (
                           <Select value={field.value} onValueChange={field.onChange}>
                             <SelectTrigger className="w-full bg-background border-border text-xs">
                               <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                               {QUOTATION_STATUS.map((s) => (
                                 <SelectItem key={s.value} value={s.value}>
                                   {s.label}
                                 </SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         ) : (
                           <div className="flex h-8 items-center rounded-lg border border-border bg-muted/40 px-2.5 text-xs font-semibold text-muted-foreground">
                             Borrador
                           </div>
                         )}
                       </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="rounded-md border border-[#0066CC]/20 bg-[#0066CC]/5 px-3 py-2.5 text-[11px] text-muted-foreground">
                <div className="font-semibold text-foreground mb-1">
                  Reglas que se aplicarán por defecto
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <span>Gastos {Math.round(options.pricing.overheadRateQuote * 100)}%</span>
                  <span>Comisión {Math.round(options.pricing.commissionRate * 100)}%</span>
                  <span>Utilidad {Math.round(options.pricing.profitRate * 100)}%</span>
                  <span>IGV {Math.round(options.pricing.igvRate * 100)}%</span>
                </div>
                <div className="mt-1 text-[10px]">
                  Las líneas y los descuentos se editan en el detalle de la cotización.
                </div>
              </div>
            </div>
          </form>
        </Form>

        <DialogFooter className="flex-col items-stretch gap-3 border-border bg-card py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end">
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
              className="flex-1 text-xs sm:flex-none"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={form.handleSubmit(handleSubmit)}
              disabled={isPending}
              className="flex-1 gap-2 text-xs sm:flex-none"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              {editingDetail ? "Guardar cambios" : "Crear y agregar líneas"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
