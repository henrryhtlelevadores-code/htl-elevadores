"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import {
  invoiceFormSchema,
  DOCUMENT_TYPES,
  CURRENCIES,
  PAYER_TYPES,
  PAYER_TAX_ID_TYPES,
  PAYER_RELATIONSHIPS,
  type InvoiceFormValues,
} from "../schema";
import { createInvoice, type InvoiceFormData } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "cn";
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Link2,
  Loader2,
  Plus,
  ReceiptText,
  Trash2,
  User,
  CalendarDays,
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

const STEPS = [
  { title: "Comprobante" },
  { title: "Conceptos" },
  { title: "Pagador" },
];

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
  payerType: "COST_CENTER",
  payerTaxIdType: "",
  payerTaxId: "",
  payerName: "",
  payerCommercialName: "",
  payerPhone: "",
  payerEmail: "",
  payerRelationship: "",
  payerNotes: "",
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
  const [step, setStep] = useState(0);

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
  const payerType = useWatch({ control: form.control, name: "payerType" });
  const payerTaxIdType = useWatch({ control: form.control, name: "payerTaxIdType" });

  const isThirdParty = payerType === "THIRD_PARTY";
  const payerIsCompany = payerTaxIdType === "RUC";
  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedCostCenter = costCenters.find((cc) => cc.id === costCenterId);

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
    const total = items.reduce((acc, it) => {
      const qty = Number(it.quantity) || 0;
      const unit = Number(it.unitPrice) || 0;
      return acc + qty * unit;
    }, 0);
    const taxableBase = total / (1 + IGV_RATE);
    const igv = total - taxableBase;
    const renta = total * RENTA_RATE;
    const detraction = total >= DETRACTION_THRESHOLD ? total * DETRACTION_RATE : 0;
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
    setStep(0);
    onOpenChange(false);
  }

  async function handleNext() {
    let ok = true;
    if (step === 0) {
      ok = await form.trigger([
        "documentType",
        "clientId",
        "issueDate",
        "currency",
        "costCenterId",
        "contractId",
      ]);
    } else if (step === 1) {
      ok = await form.trigger("items");
    }
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function handlePayerTypeChange(value: "COST_CENTER" | "THIRD_PARTY") {
    form.setValue("payerType", value, { shouldDirty: true });
    if (value === "COST_CENTER") {
      form.setValue("payerTaxIdType", "", { shouldDirty: true });
      form.setValue("payerTaxId", "", { shouldDirty: true });
      form.setValue("payerName", "", { shouldDirty: true });
      form.setValue("payerCommercialName", "", { shouldDirty: true });
      form.setValue("payerPhone", "", { shouldDirty: true });
      form.setValue("payerEmail", "", { shouldDirty: true });
      form.setValue("payerRelationship", "", { shouldDirty: true });
      form.setValue("payerNotes", "", { shouldDirty: true });
    }
    form.clearErrors([
      "payerType",
      "payerTaxIdType",
      "payerTaxId",
      "payerName",
      "payerCommercialName",
      "payerPhone",
      "payerEmail",
      "payerRelationship",
      "payerNotes",
    ]);
  }

  function handlePayerTaxIdTypeChange(value: string) {
    form.setValue("payerTaxIdType", value as InvoiceFormValues["payerTaxIdType"], {
      shouldDirty: true,
    });
    form.setValue("payerTaxId", "", { shouldDirty: true });
    form.setValue("payerCommercialName", "", { shouldDirty: true });
    form.clearErrors(["payerTaxId", "payerCommercialName"]);
  }

  function handleSubmit(values: InvoiceFormValues) {
    if (step < STEPS.length - 1) {
      handleNext();
      return;
    }
    startTransition(async () => {
      const res = await createInvoice(values);
      if (res.success) {
        toast.success("Factura registrada", { description: res.message });
        form.reset();
        setStep(0);
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
            Registra un comprobante con sus conceptos. Los precios incluyen IGV (18%): la base
            imponible se calcula como Precio Total / 1.18.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const done = step > i;
            const active = step === i;
            return (
              <div key={s.title} className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <div
                    className={cn(
                      "size-6 rounded-full border flex items-center justify-center shrink-0",
                      active
                        ? "bg-[#0066CC] border-[#0066CC] text-white"
                        : done
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "bg-muted/60 border-border text-muted-foreground"
                    )}
                  >
                    {done ? (
                      <Check className="size-3.5" />
                    ) : (
                      <span className="text-[11px] font-bold">{i + 1}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold whitespace-nowrap",
                      active
                        ? "text-foreground"
                        : done
                          ? "text-foreground/70"
                          : "text-muted-foreground"
                    )}
                  >
                    {s.title}
                  </span>
                </div>
                {i < STEPS.length - 1 && <div className="h-px w-6 sm:w-10 bg-border mx-1 shrink-0" />}
              </div>
            );
          })}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 pt-2">
            {step === 0 && (
              <>
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
                        <SearchableSelect
                          items={clients}
                          value={field.value ?? ""}
                          onValueChange={(v) => {
                            field.onChange(v);
                            form.setValue("costCenterId", "", { shouldDirty: true });
                            form.setValue("contractId", "", { shouldDirty: true });
                          }}
                          getValue={(c) => c.id}
                          getLabel={(c) => c.legalName}
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
                      <FormLabel className="text-xs font-semibold">Centro de costo</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          items={filteredCostCenters}
                          value={field.value ?? ""}
                          onValueChange={(v) => {
                            field.onChange(v);
                            form.setValue("contractId", "", { shouldDirty: true });
                          }}
                          getValue={(cc) => cc.id}
                          getLabel={(cc) => cc.name}
                          getKeywords={(cc) => cc.client_name}
                          placeholder={clientId ? "Selecciona un centro de costo" : "Elige un cliente primero"}
                          searchPlaceholder="Buscar centro de costo..."
                          emptyText="Este cliente no tiene centros de costo"
                          disabled={!clientId}
                          allowClear
                          clearLabel="Sin centro de costo"
                        />
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
              </>
            )}

            {step === 1 && (
              <>
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
                <span>Detracción (4%){totals.total >= DETRACTION_THRESHOLD ? "" : " · no aplica"}</span>
                <span className="tabular-nums">{fmt(round2(totals.detraction))}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-border font-bold text-sm">
                <span>Precio Total</span>
                <span className="tabular-nums text-[#0066CC] dark:text-blue-400">
                  {currency} {fmt(round2(totals.total))}
                </span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>Neto a pagar (Precio Total − Detracción)</span>
                <span className="tabular-nums">{currency} {fmt(round2(totals.netPayable))}</span>
              </div>
            </div>
              </>
            )}

            {step === 2 && (
              <>
            {/* 5. Pagador */}
            <div className="space-y-3">
              <SectionTitle icon={User} title="¿Quién paga?" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PAYER_TYPES.map((option) => {
                  const active = (payerType ?? "COST_CENTER") === option.value;
                  const isCc = option.value === "COST_CENTER";
                  const Icon = isCc ? Building2 : User;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        handlePayerTypeChange(option.value as "COST_CENTER" | "THIRD_PARTY")
                      }
                      className={cn(
                        "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                        active
                          ? "border-[#0066CC] bg-[#0066CC]/5"
                          : "border-border bg-muted/20 hover:border-[#0066CC]/40"
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 size-7 rounded-md border flex items-center justify-center shrink-0",
                          active
                            ? "border-[#0066CC] bg-[#0066CC] text-white"
                            : "border-border bg-card text-muted-foreground"
                        )}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold">{option.label}</div>
                        <div className="text-[11px] text-muted-foreground leading-snug">
                          {isCc
                            ? "El comprobante sale al centro de costos y el centro de costos paga."
                            : "Pagado por un tercero: residente, propietario o empresa."}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {!isThirdParty && (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 flex items-start gap-2">
                  <Info className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    El comprobante fiscal se emite a nombre de{" "}
                    <strong className="text-foreground">
                      {selectedClient?.legalName ?? "—"}
                    </strong>
                    {selectedCostCenter ? ` · ${selectedCostCenter.name}` : ""}. No se registran
                    datos de un pagador externo.
                  </p>
                </div>
              )}

              {isThirdParty && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
                    <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      El comprobante fiscal se sigue emitiendo con los datos de{" "}
                      <strong className="text-foreground">
                        {selectedClient?.legalName ?? "—"}
                      </strong>
                      {selectedCostCenter ? ` · ${selectedCostCenter.name}` : ""}. El pagador
                      solo queda registrado internamente y no altera el cliente del comprobante.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="payerTaxIdType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Tipo de documento</FormLabel>
                          <Select
                            value={field.value ?? ""}
                            onValueChange={(v) => handlePayerTaxIdTypeChange(v ?? "")}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                                <SelectValue placeholder="Selecciona" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PAYER_TAX_ID_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payerTaxId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">
                            {payerIsCompany ? "RUC" : "DNI / Documento"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={
                                payerTaxIdType === "DNI"
                                  ? "Ej: 45678912"
                                  : payerTaxIdType === "RUC"
                                    ? "Ej: 20123456789"
                                    : "Ej: 001234567"
                              }
                              {...field}
                              value={field.value ?? ""}
                              className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">
                            {payerIsCompany ? "Razón social" : "Nombre completo"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={
                                payerIsCompany
                                  ? "Ej: Fabrizio Rossi SAC"
                                  : "Ej: Fabrizio Rossi"
                              }
                              {...field}
                              value={field.value ?? ""}
                              className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {payerIsCompany && (
                      <FormField
                        control={form.control}
                        name="payerCommercialName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold">
                              Nombre comercial (opcional)
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ej: Rossi Import"
                                {...field}
                                value={field.value ?? ""}
                                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={form.control}
                      name="payerRelationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Relación</FormLabel>
                          <Select
                            value={field.value ?? ""}
                            onValueChange={(v) => field.onChange(v ?? "")}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                                <SelectValue placeholder="Selecciona" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PAYER_RELATIONSHIPS.map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Teléfono (opcional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ej: 987654321"
                              {...field}
                              value={field.value ?? ""}
                              className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="payerEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Correo (opcional)</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="Ej: fabrizio@correo.com"
                              {...field}
                              value={field.value ?? ""}
                              className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="payerNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Notas (opcional)</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={2}
                            placeholder="Ej: Rompió panel del piso 5"
                            {...field}
                            value={field.value ?? ""}
                            className="resize-none bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
              </>
            )}

            <DialogFooter className="pt-1 gap-2 flex-wrap items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Total:{" "}
                <span className="text-foreground tabular-nums">
                  {currency} {fmt(round2(totals.total))}
                </span>
              </span>
              <div className="flex items-center gap-2">
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
                {step > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleBack}
                    disabled={isPending}
                    className="text-xs border-border gap-1"
                  >
                    <ChevronLeft className="size-3.5" />
                    Volver
                  </Button>
                )}
                {step < STEPS.length - 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleNext}
                    disabled={isPending}
                    className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-1"
                  >
                    Siguiente
                    <ChevronRight className="size-3.5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={form.handleSubmit(handleSubmit)}
                    disabled={isPending}
                    className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
                  >
                    {isPending && <Loader2 className="size-3.5 animate-spin" />}
                    Guardar Factura
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}