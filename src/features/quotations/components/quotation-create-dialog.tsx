"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import {
  quotationFormSchema,
  QUOTATION_STATUS,
  type QuotationFormValues,
} from "../schema";
import { createQuotation, updateQuotation } from "../actions";
import type { QuotationDetail, QuotationFormOptions } from "../actions";
import {
  calculateQuotationLine,
  calculateQuotationHeader,
  LINE_MODES,
  DISCOUNT_MODES,
  type LineMode,
} from "../calc";
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
import {
  ArrowUp,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Pill,
  Plus,
  ReceiptText,
  Settings2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";

interface QuotationCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  editingDetail: QuotationDetail | null;
  options: QuotationFormOptions;
  defaultHourlyCost: number;
}

const money = (value: number) =>
  value.toLocaleString("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  });

const todayInput = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const plusDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const tsToInput = (ts: number | null | undefined) => {
  if (!ts) return todayInput();
  const d = new Date(ts * 1000);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
};

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="size-3.5" />
      {title}
    </div>
  );
}

const STEPS = [
  { title: "Datos generales", icon: ReceiptText },
  { title: "Equipos y servicios", icon: Settings2 },
  { title: "Descuento y confirmar", icon: Calculator },
] as const;

const emptyProduct = () => ({
  description: "",
  quantity: "1",
  unit: "",
  unitCost: "",
});

const makeDefaultLine = (hourlyCost: number) => ({
  elevatorUnityId: "",
  description: "",
  totalHours: "0",
  hourlyCost: String(hourlyCost || 0),
  lineMode: "CALCULATED" as LineMode,
  lineModeReason: "",
  lineOverridePrice: "",
  lineOverrideReason: "",
  products: [emptyProduct()],
});

function defaultValues(hourlyCost: number): QuotationFormValues {
  return {
    clientId: "",
    costCenterId: "",
    advisorId: "",
    issueDate: todayInput(),
    validUntil: plusDays(30),
    status: "DRAFT",
    discountMode: "PERCENT",
    discountRate: "0",
    discountAmount: "0",
    targetTotal: "",
    targetTotalIncludesIgv: true,
    notes: "",
    terms: "",
    lines: [makeDefaultLine(hourlyCost)],
  };
}

function detailToValues(
  detail: QuotationDetail,
  hourlyCost: number
): QuotationFormValues {
  return {
    clientId: detail.clientId,
    costCenterId: detail.costCenterId ?? "",
    advisorId: detail.advisorId ?? "",
    issueDate: tsToInput(detail.issueDate),
    validUntil: tsToInput(detail.validUntil),
    status: detail.status ?? "DRAFT",
    discountMode: (detail.discountMode ?? "PERCENT") as QuotationFormValues["discountMode"],
    discountRate: String(detail.discountRate ?? 0),
    discountAmount: String(detail.discountAmount ?? 0),
    targetTotal: detail.targetTotal != null ? String(detail.targetTotal) : "",
    targetTotalIncludesIgv: detail.targetTotalIncludesIgv ?? true,
    notes: detail.notes ?? "",
    terms: detail.terms ?? "",
    lines:
      detail.lines.length > 0
        ? detail.lines.map((l) => ({
            elevatorUnityId: l.elevatorUnityId ?? "",
            description: l.description ?? "",
            totalHours: String(l.totalHours ?? 0),
            hourlyCost: String(l.hourlyCost ?? hourlyCost),
            lineMode: (l.lineMode ?? "CALCULATED") as LineMode,
            lineModeReason: l.lineModeReason ?? "",
            lineOverridePrice:
              l.lineOverridePrice != null ? String(l.lineOverridePrice) : "",
            lineOverrideReason: l.lineOverrideReason ?? "",
            products:
              l.products.length > 0
                ? l.products.map((p) => ({
                    description: p.description,
                    quantity: String(p.quantity ?? 1),
                    unit: p.unit ?? "",
                    unitCost: String(p.unitCost ?? 0),
                  }))
                : [emptyProduct()],
          }))
        : [makeDefaultLine(hourlyCost)],
  };
}

function LineProductsField({
  control,
  lineIndex,
}: {
  control: ReturnType<
    typeof useForm<z.input<typeof quotationFormSchema>, unknown, z.output<typeof quotationFormSchema>>
  >["control"];
  lineIndex: number;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `lines.${lineIndex}.products`,
  });

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">
          Materiales / productos
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => append(emptyProduct())}
        >
          <Plus className="size-3.5" />
          Agregar
        </Button>
      </div>
      {fields.map((field, index) => (
        <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
          <FormField
            control={control}
            name={`lines.${lineIndex}.products.${index}.description`}
            render={({ field: f }) => (
              <FormItem className="col-span-6 sm:col-span-5">
                <FormControl>
                  <Input
                    placeholder="Descripción del material"
                    {...f}
                    className="bg-background border-border text-xs"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`lines.${lineIndex}.products.${index}.quantity`}
            render={({ field: f }) => (
              <FormItem className="col-span-2 sm:col-span-1">
                <FormControl>
                  <Input
                    placeholder="Cant."
                    inputMode="decimal"
                    {...f}
                    className="bg-background border-border text-xs"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`lines.${lineIndex}.products.${index}.unit`}
            render={({ field: f }) => (
              <FormItem className="col-span-2 sm:col-span-1">
                <FormControl>
                  <Input
                    placeholder="Und"
                    {...f}
                    className="bg-background border-border text-xs"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`lines.${lineIndex}.products.${index}.unitCost`}
            render={({ field: f }) => (
              <FormItem className="col-span-2 sm:col-span-2">
                <FormControl>
                  <Input
                    placeholder="C. unit."
                    inputMode="decimal"
                    {...f}
                    className="bg-background border-border text-xs"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="col-span-1 flex justify-center pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-7 h-7 text-muted-foreground hover:text-destructive"
              onClick={() => remove(index)}
              disabled={fields.length <= 1}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuotationCreateDialog({
  open,
  onOpenChange,
  onSaved,
  editingDetail,
  options,
  defaultHourlyCost,
}: QuotationCreateDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);

  type FormInput = z.input<typeof quotationFormSchema>;
  type FormOutput = z.output<typeof quotationFormSchema>;

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(quotationFormSchema),
    defaultValues: defaultValues(defaultHourlyCost),
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const clientId = useWatch({ control: form.control, name: "clientId" });
  const currentLines = useWatch({ control: form.control, name: "lines" });
  const discountMode = useWatch({ control: form.control, name: "discountMode" });
  const discountRate = useWatch({ control: form.control, name: "discountRate" });
  const discountAmount = useWatch({ control: form.control, name: "discountAmount" });
  const targetTotal = useWatch({ control: form.control, name: "targetTotal" });
  const targetTotalIncludesIgv = useWatch({
    control: form.control,
    name: "targetTotalIncludesIgv",
  });

  const lineModes = useMemo(
    () => (currentLines ?? []).map((l) => (l.lineMode ?? "CALCULATED") as LineMode),
    [currentLines]
  );

  const filteredCostCenters = useMemo(
    () =>
      clientId
        ? options.costCenters.filter((cc) => cc.clientId === clientId)
        : [],
    [clientId, options.costCenters]
  );

  const summary = useMemo(() => {
    const lines = (currentLines ?? []).map((l, i) => {
      const hourlyCost = Number(l.hourlyCost) || 0;
      const products = (l.products ?? [])
        .filter((p) => p.description.trim() !== "" || Number(p.unitCost) > 0)
        .map((p) => ({
          quantity: Number(p.quantity),
          unitCost: Number(p.unitCost),
        }));
      return {
        i,
        calc: calculateQuotationLine(
          {
            totalHours: Number(l.totalHours) || 0,
            hourlyCost,
            products,
            lineMode: (l.lineMode ?? "CALCULATED") as LineMode,
            lineOverridePrice: Number(l.lineOverridePrice) || null,
          },
          hourlyCost,
          options.pricing
        ),
      };
    });
    const byLine = new Map(lines.map((l) => [l.i, l.calc]));
    const header = calculateQuotationHeader(
      lines.map((l) => ({ clientValue: l.calc.clientValue })),
      {
        discountMode: (discountMode ?? "PERCENT") as QuotationFormValues["discountMode"],
        discountRate: Number(discountRate) || 0,
        discountAmount: Number(discountAmount) || 0,
        targetTotal: Number(targetTotal) || null,
        targetTotalIncludesIgv: targetTotalIncludesIgv ?? true,
      },
      options.pricing
    );
    return { byLine, header };
  }, [
    currentLines,
    discountMode,
    discountRate,
    discountAmount,
    targetTotal,
    targetTotalIncludesIgv,
    options.pricing,
  ]);

  useEffect(() => {
    if (open) {
      form.reset(
        editingDetail
          ? detailToValues(editingDetail, defaultHourlyCost)
          : defaultValues(defaultHourlyCost)
      );
      form.clearErrors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingDetail]);

  function handleClose() {
    if (isPending) return;
    form.reset();
    setStep(0);
    onOpenChange(false);
  }

  async function handleNext() {
    let ok = true;
    if (step === 0) {
      ok = await form.trigger(["clientId", "issueDate", "validUntil"]);
    } else if (step === 1) {
      ok = await form.trigger("lines");
    }
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleSubmit(values: QuotationFormValues) {
    startTransition(async () => {
      const res = editingDetail
        ? await updateQuotation(editingDetail.id, values)
        : await createQuotation(values);
      if (res.success) {
        toast.success(
          editingDetail ? "Cotización actualizada" : "Cotización creada",
          { description: res.message }
        );
        form.reset();
        onOpenChange(false);
        onSaved?.();
      } else {
        toast.error("Error al guardar", { description: res.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="bg-card border-border sm:max-w-[980px] text-foreground shadow-lg max-h-[94vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <FileText className="size-4 text-[#0066CC]" />
            {editingDetail ? `Editar cotización ${editingDetail.quotationNumber}` : "Nueva cotización"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Precio de venta calculado con: materiales + mano de obra + gastos generales (
            {Math.round(options.pricing.overheadRateQuote * 100)}%) + comisión (
            {Math.round(options.pricing.commissionRate * 100)}%) + margen (
            {Math.round(options.pricing.profitRate * 100)}%), más IGV (
            {Math.round(options.pricing.igvRate * 100)}%).
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
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
                {i < STEPS.length - 1 && (
                  <div className="h-px w-6 sm:w-10 bg-border mx-1 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 pt-2">
            {step === 0 && (
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
                          onValueChange={(v) => field.onChange(v)}
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            )}

            {step === 1 && (
            <div className="space-y-3">
              <SectionTitle icon={Settings2} title="Equipos y servicios" />
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="rounded-lg border border-border bg-muted/20 p-3 space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="grid grid-cols-12 gap-2 flex-1">
                        <FormField
                          control={form.control}
                          name={`lines.${index}.elevatorUnityId`}
                          render={({ field: f }) => (
                            <FormItem className="col-span-12 sm:col-span-4">
                              <FormLabel className="text-[10px] text-muted-foreground">
                                Seleccione el Equipo
                              </FormLabel>
                              <FormControl>
                                <Select value={f.value} onValueChange={f.onChange}>
                                  <SelectTrigger className="w-full bg-background border-border text-xs">
                                    <SelectValue placeholder="Equipo (opcional)" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {options.equipment.map((e) => (
                                      <SelectItem key={e.id} value={e.id}>
                                        {[e.internalCode, e.name].filter(Boolean).join(" — ")}
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
                          name={`lines.${index}.totalHours`}
                          render={({ field: f }) => (
                            <FormItem className="col-span-4 sm:col-span-2">
                              <FormLabel className="text-[10px] text-muted-foreground">
                                Horas de trabajo (HH)
                              </FormLabel>
                              <FormControl>
                                <Input
                                  inputMode="decimal"
                                  placeholder="0"
                                  {...f}
                                  className="bg-background border-border text-xs"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`lines.${index}.hourlyCost`}
                          render={({ field: f }) => (
                            <FormItem className="col-span-4 sm:col-span-2">
                              <FormLabel className="text-[10px] text-muted-foreground">
                                Costo/hora (S/)
                              </FormLabel>
                              <FormControl>
                                <Input
                                  inputMode="decimal"
                                  placeholder="0.00"
                                  {...f}
                                  className="bg-background border-border text-xs"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="col-span-4 sm:col-span-3 text-right">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                            Precio venta
                          </div>
                          <div className="text-sm font-bold">
                            {money(summary.byLine.get(index)?.clientPrice ?? 0)}
                          </div>
                        </div>
                        <div className="col-span-12 sm:col-span-1 flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="size-7 h-7 text-muted-foreground hover:text-foreground"
                            onClick={() => move(index, index - 1)}
                            disabled={index === 0}
                          >
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="size-7 h-7 text-muted-foreground hover:text-destructive"
                            onClick={() => remove(index)}
                            disabled={fields.length <= 1}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name={`lines.${index}.description`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormControl>
                            <Input
                              placeholder="Descripción del servicio (ej: Mantenimiento preventivo semestral)"
                              {...f}
                              className="bg-background border-border text-xs"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-12 gap-2 items-start rounded-md border border-border/70 bg-background/60 p-2.5">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.lineMode`}
                        render={({ field: f }) => (
                          <FormItem className="col-span-12 sm:col-span-4">
                            <FormLabel className="text-[10px] text-muted-foreground">
                              Modo de cobro
                            </FormLabel>
                            <FormControl>
                              <Select
                                value={f.value}
                                onValueChange={(v) => {
                                  f.onChange(v);
                                  form.setValue(`lines.${index}.lineOverridePrice`, "");
                                  form.setValue(`lines.${index}.lineModeReason`, "");
                                  form.setValue(`lines.${index}.lineOverrideReason`, "");
                                }}
                              >
                                <SelectTrigger className="w-full bg-background border-border text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {LINE_MODES.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                      {m.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {lineModes[index] === "FIXED_PRICE" && (
                        <>
                          <FormField
                            control={form.control}
                            name={`lines.${index}.lineOverridePrice`}
                            render={({ field: f }) => (
                              <FormItem className="col-span-6 sm:col-span-3">
                                <FormLabel className="text-[10px] text-muted-foreground">
                                  Precio final c/IGV (S/)
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    {...f}
                                    className="bg-background border-border text-xs"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`lines.${index}.lineOverrideReason`}
                            render={({ field: f }) => (
                              <FormItem className="col-span-6 sm:col-span-5">
                                <FormLabel className="text-[10px] text-muted-foreground">
                                  Motivo del precio
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Ej: precio pactado con el cliente"
                                    {...f}
                                    className="bg-background border-border text-xs"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                      {lineModes[index] === "PASSTHROUGH" && (
                        <FormField
                          control={form.control}
                          name={`lines.${index}.lineModeReason`}
                          render={({ field: f }) => (
                            <FormItem className="col-span-12 sm:col-span-8">
                              <FormLabel className="text-[10px] text-muted-foreground">
                                Motivo (obligatorio)
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ej: servicio lifto por proveedor externo"
                                  {...f}
                                  className="bg-background border-border text-xs"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      {lineModes[index] === "CALCULATED" && (
                        <p className="col-span-12 text-[10px] text-muted-foreground sm:col-span-8">
                          Se aplica gastos generales, comisión y margen automáticamente.
                        </p>
                      )}
                    </div>

                    <LineProductsField control={form.control} lineIndex={index} />
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={() => append(makeDefaultLine(defaultHourlyCost))}
              >
                <Plus className="size-3.5" />
                Agregar línea
              </Button>
            </div>
            )}

            {step === 2 && (
            <>
            <div className="space-y-3">
              <SectionTitle icon={Pill} title="Descuento y observaciones" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="discountMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Tipo de descuento</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v);
                            form.setValue("discountRate", "0");
                            form.setValue("discountAmount", "0");
                            form.setValue("targetTotal", "");
                          }}
                        >
                          <SelectTrigger className="w-full bg-background border-border text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DISCOUNT_MODES.map((m) => (
                              <SelectItem key={m.value} value={m.value}>
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {discountMode === "PERCENT" && (
                  <FormField
                    control={form.control}
                    name="discountRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Descuento (%)</FormLabel>
                        <FormControl>
                          <Input
                            inputMode="decimal"
                            placeholder="0"
                            {...field}
                            className="bg-background border-border text-xs"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {discountMode === "AMOUNT" && (
                  <FormField
                    control={form.control}
                    name="discountAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">
                          Monto del descuento (S/)
                        </FormLabel>
                        <FormControl>
                          <Input
                            inputMode="decimal"
                            placeholder="0.00"
                            {...field}
                            className="bg-background border-border text-xs"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {discountMode === "FINAL" && (
                  <>
                    <FormField
                      control={form.control}
                      name="targetTotal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">
                            Precio final (S/)
                          </FormLabel>
                          <FormControl>
                            <Input
                              inputMode="decimal"
                              placeholder="0.00"
                              {...field}
                              className="bg-background border-border text-xs"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="sm:col-span-2 sm:pt-6">
                      <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <input
                          type="checkbox"
                          checked={targetTotalIncludesIgv ?? true}
                          onChange={(e) =>
                            form.setValue("targetTotalIncludesIgv", e.target.checked)
                          }
                          className="size-4 accent-[#0066CC]"
                        />
                        El precio final ya incluye IGV
                      </label>
                    </div>
                  </>
                )}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className={discountMode === "FINAL" ? "" : "sm:col-span-3"}>
                      <FormLabel className="text-xs font-semibold">Notas</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Comentarios generales..."
                          rows={2}
                          {...field}
                          className="bg-background border-border text-xs resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="terms"
                  render={({ field }) => (
                    <FormItem className={discountMode === "FINAL" ? "" : "sm:col-span-3"}>
                      <FormLabel className="text-xs font-semibold">Condiciones</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Plazos, garantías, forma de pago..."
                          rows={2}
                          {...field}
                          className="bg-background border-border text-xs resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Resumen de cálculo
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground">Subtotal</div>
                  <div className="text-sm font-semibold">{money(summary.header.subtotal)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Descuento</div>
                  <div className="text-sm font-semibold">
                    {summary.header.discountAmount > 0
                      ? `-${money(summary.header.discountAmount)}`
                      : money(0)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Base</div>
                  <div className="text-sm font-semibold">{money(summary.header.taxableBase)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">
                    IGV {Math.round(options.pricing.igvRate * 100)}%
                  </div>
                  <div className="text-sm font-semibold">{money(summary.header.igv)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Total</div>
                  <div className="text-sm font-bold text-[#0066CC]">
                    {money(summary.header.total)}
                  </div>
                </div>
              </div>
            </div>
            </>
            )}
          </form>
        </Form>

        <DialogFooter className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted-foreground">
            Total:{" "}
            <span className="text-foreground">
              {step >= 1 ? money(summary.header.total) : "—"}
            </span>
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isPending} className="text-xs">
              Cancelar
            </Button>
            {step > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isPending}
                className="text-xs gap-1"
              >
                <ChevronLeft className="size-3.5" />
                Volver
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={isPending}
                className="text-xs gap-1"
              >
                Siguiente
                <ChevronRight className="size-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={form.handleSubmit(handleSubmit)}
                disabled={isPending}
                className="text-xs gap-2"
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                {editingDetail ? "Guardar cambios" : "Crear cotización"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}