"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import {
  invoiceFormSchema,
  DOCUMENT_TYPES,
  CURRENCIES,
  type InvoiceFormValues,
} from "../schema";
import { createInvoice, type InvoiceFormData } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Loader2,
  Plus,
  ReceiptText,
  Trash2,
  FileText,
  CalendarDays,
  Link2,
} from "lucide-react";

interface InvoiceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  clients: Array<{ id: string; legalName: string }>;
  costCenters: Array<{
    id: string;
    name: string;
    clientId: string;
    client_name: string;
  }>;
  formData: InvoiceFormData;
}

const IGV_RATE = 0.18;
const RENTA_RATE = 0.015;
const DETRACTION_RATE = 0.04;
const DETRACTION_THRESHOLD = 700;

const round2 = (value: number) => Math.round(value * 100) / 100;

const defaultValues = (): InvoiceFormValues => ({
  documentType: "FACTURA",
  series: "",
  number: "",
  clientId: "",
  costCenterId: "",
  contractId: "",
  issueDate: "",
  currency: "PEN",
  items: [
    {
      description: "",
      serviceTypeId: "",
      quantity: "1",
      unitPrice: "",
    },
  ],
});

const fmt = (value: number) =>
  value.toLocaleString("es-PE", { minimumFractionDigits: 2 });

function SectionTitle({
  icon: Icon,
  title,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="size-3.5" />
      {title}
      {badge}
    </div>
  );
}

export function InvoiceCreateDialog({
  open,
  onOpenChange,
  onCreated,
  clients,
  costCenters,
  formData,
}: InvoiceCreateDialogProps) {
  const [isPending, startTransition] = useTransition();

  type InvoiceFormInput = z.input<typeof invoiceFormSchema>;
  type InvoiceFormOutput = z.output<typeof invoiceFormSchema>;

  const form = useForm<InvoiceFormInput, unknown, InvoiceFormOutput>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: defaultValues(),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const clientId = useWatch({ control: form.control, name: "clientId" });
  const costCenterId = useWatch({ control: form.control, name: "costCenterId" });
  const currency = useWatch({ control: form.control, name: "currency" });
  const currentItems = useWatch({ control: form.control, name: "items" });

  const filteredCostCenters = useMemo(
    () =>
      clientId
        ? costCenters.filter((cc) => cc.clientId === clientId)
        : [],
    [clientId, costCenters]
  );

  const filteredContracts = useMemo(
    () =>
      costCenterId
        ? formData.contracts.filter((c) => c.costCenterId === costCenterId)
        : [],
    [costCenterId, formData.contracts]
  );

  const totals = useMemo(() => {
    const items = currentItems ?? [];
    const taxableBase = items.reduce((acc, it) => {
      const qty = Number(it.quantity) || 0;
      const unit = Number(it.unitPrice) || 0;
      return acc + qty * unit;
    }, 0);
    const igv = taxableBase * IGV_RATE;
    const total = taxableBase + igv;
    const renta = total * RENTA_RATE;
    const detraction = total > DETRACTION_THRESHOLD ? total * DETRACTION_RATE : 0;
    return {
      taxableBase,
      igv,
      total,
      renta,
      detraction,
      netPayable: total - detraction,
    };
  }, [currentItems]);

  useEffect(() => {
    if (open) {
      form.reset(defaultValues());
      form.clearErrors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    if (isPending) return;
    form.reset();
    onOpenChange(false);
  }

  function handleSubmit(values: InvoiceFormValues) {
    startTransition(async () => {
      const res = await createInvoice(values);
      if (res.success) {
        toast.success("Factura registrada", { description: res.message });
        form.reset();
        onOpenChange(false);
        onCreated?.();
      } else {
        toast.error("Error al registrar", { description: res.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="bg-card border-border sm:max-w-[880px] text-foreground shadow-lg max-h-[94vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ReceiptText className="size-4 text-[#0066CC]" />
            Nueva Factura
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Registra un comprobante con sus conceptos. Los montos se calculan con IGV (18%).
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 pt-2">
            {/* 1. Comprobante y cliente */}
            <div className="space-y-3">
              <SectionTitle icon={ReceiptText} title="Comprobante y cliente" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="documentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Tipo de comprobante</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DOCUMENT_TYPES.map((d) => (
                              <SelectItem key={d.value} value={d.value}>
                                {d.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="series"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Serie</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: F001"
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          value={field.value}
                          className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Número</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Dejar vacío para borrador"
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          value={field.value}
                          className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Cliente</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v ?? "");
                            form.setValue("costCenterId", "", { shouldDirty: true });
                            form.setValue("contractId", "", { shouldDirty: true });
                          }}
                        >
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue placeholder="Selecciona un cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.legalName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                      <FormLabel className="text-xs font-semibold">Centro de costo</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v ?? "");
                            form.setValue("contractId", "", { shouldDirty: true });
                          }}
                          disabled={!clientId}
                        >
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue placeholder={clientId ? "Sin centro de costo" : "Elige un cliente primero"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Sin centro de costo</SelectItem>
                            {filteredCostCenters.map((cc) => (
                              <SelectItem key={cc.id} value={cc.id}>
                                {cc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Moneda</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
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
            </div>

            {/* 2. Fecha de emisión */}
            <div className="space-y-3">
              <SectionTitle icon={CalendarDays} title="Fecha de emisión" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="issueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Fecha de emisión</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 3. Referencias */}
            <div className="space-y-3">
              <SectionTitle icon={Link2} title="Referencias" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="contractId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Contrato</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={(v) => field.onChange(v ?? "")}
                          disabled={!costCenterId}
                        >
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue placeholder={costCenterId ? "Sin contrato" : "Elige un centro de costo"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Sin contrato</SelectItem>
                            {filteredContracts.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.contractNumber} · {c.status}
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
            </div>

            {/* 4. Conceptos */}
            <div className="space-y-3">
              <SectionTitle
                icon={FileText}
                title="Conceptos"
                badge={
                  <span className="ml-1 text-muted-foreground/70 normal-case tracking-normal">
                    ({fields.length})
                  </span>
                }
              />
              <div className="space-y-3">
                {fields.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border bg-muted/20 p-3 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Concepto {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        className="text-red-500 hover:text-red-700 hover:bg-red-500/10 disabled:opacity-40"
                        title="Quitar concepto"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="Descripción del servicio"
                                {...field}
                                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.serviceTypeId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold">Servicio</FormLabel>
                            <FormControl>
                              <Select
                                value={field.value}
                                onValueChange={(v) => field.onChange(v ?? "")}
                              >
                                <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                                  <SelectValue placeholder="Opcional" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Sin servicio</SelectItem>
                                  {formData.serviceTypes.map((st) => (
                                    <SelectItem key={st.id} value={st.id}>
                                      {st.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold">Cantidad</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                {...field}
                                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold">Precio unitario</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                {...field}
                                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-end text-[10px] font-semibold text-muted-foreground tabular-nums">
                      <span>Importe: {fmt(Math.round((Number(currentItems?.[index]?.unitPrice ?? 0) * Number(currentItems?.[index]?.quantity ?? 0) || 0) * 100) / 100)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    description: "",
                    serviceTypeId: "",
                    quantity: "1",
                    unitPrice: "",
                  })
                }
                className="text-xs font-semibold gap-1.5 text-[#0066CC] dark:text-blue-400 border-[#0066CC]/30 hover:bg-[#0066CC]/10"
              >
                <Plus className="size-3.5" />
                Agregar concepto
              </Button>
            </div>

            {/* Resumen */}
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Base imponible</span>
                <span className="tabular-nums">{fmt(round2(totals.taxableBase))}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>IGV (18%)</span>
                <span className="tabular-nums">{fmt(round2(totals.igv))}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Renta (1.5%)</span>
                <span className="tabular-nums">{fmt(round2(totals.renta))}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Detracción (4%){totals.total > DETRACTION_THRESHOLD ? "" : " · no aplica"}</span>
                <span className="tabular-nums">{fmt(round2(totals.detraction))}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-border font-bold text-sm">
                <span>Total</span>
                <span className="tabular-nums text-[#0066CC] dark:text-blue-400">
                  {currency} {fmt(round2(totals.total))}
                </span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>Neto a pagar</span>
                <span className="tabular-nums">{currency} {fmt(round2(totals.netPayable))}</span>
              </div>
            </div>

            <DialogFooter className="pt-1 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isPending}
                className="text-xs border-border"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                Guardar Factura
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}