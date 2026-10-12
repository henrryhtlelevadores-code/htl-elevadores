"use client";

import { useCallback, useMemo, useState } from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import type { QuotationFormOptions } from "../actions";
import { LINE_MODES, type LineMode } from "../calc";
import {
  emptyProduct,
  makeDefaultLine,
  money,
  SectionTitle,
  useQuotationSummary,
  type QuotationForm,
} from "./quotation-form-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUp, Plus, Settings2, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";

type ServiceTypeOption = QuotationFormOptions["serviceTypes"][number];
const serviceTypeValue = (s: ServiceTypeOption) => s.id;
const serviceTypeLabel = (s: ServiceTypeOption) => s.name;
const serviceTypeKeywords = (s: ServiceTypeOption) => s.code;

function LineProductsField({
  control,
  lineIndex,
}: {
  control: QuotationForm["control"];
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
      <div className="grid grid-cols-12 gap-2 px-0.5">
        <span className="col-span-6 sm:col-span-5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Descripción
        </span>
        <span className="col-span-2 sm:col-span-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Cant.
        </span>
        <span
          className="col-span-2 sm:col-span-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          title="Unidad de medida del material (und, kg, m, jgo, etc.)"
        >
          Und.
        </span>
        <span
          className="col-span-2 sm:col-span-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          title="Costo unitario: precio en soles por cada unidad de medida"
        >
          C. unit. (S/)
        </span>
        <span className="col-span-1" />
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
                    placeholder="und, kg, m..."
                    title="Unidad de medida del material"
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
                    placeholder="S/ por unidad"
                    title="Costo unitario: precio en soles por cada unidad de medida"
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


/** Tab "Líneas de Cotización": equipo, modo de cobro, descripción, horas y materiales. */
export function QuotationLinesEditor({
  form,
  options,
  defaultHourlyCost,
}: {
  form: QuotationForm;
  options: QuotationFormOptions;
  defaultHourlyCost: number;
}) {
  const [expandedProviders, setExpandedProviders] = useState<Record<number, boolean>>({});
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const clientId = useWatch({ control: form.control, name: "clientId" });
  const costCenterId = useWatch({ control: form.control, name: "costCenterId" });
  const { currentLines, summary } = useQuotationSummary(form, options.pricing);

  const lineModes = useMemo(
    () => (currentLines ?? []).map((l) => (l.lineMode ?? "CALCULATED") as LineMode),
    [currentLines]
  );

  const equipmentScope = useMemo(() => {
    if (costCenterId) return new Set([costCenterId]);
    if (!clientId) return null;
    return new Set(
      options.costCenters.filter((cc) => cc.clientId === clientId).map((cc) => cc.id)
    );
  }, [clientId, costCenterId, options.costCenters]);

  const filteredEquipment = useMemo(
    () =>
      equipmentScope
        ? options.equipment.filter((e) => equipmentScope.has(e.costCenterId))
        : options.equipment,
    [equipmentScope, options.equipment]
  );

  const equipmentById = useMemo(
    () => new Map(options.equipment.map((e) => [e.id, e])),
    [options.equipment]
  );

  // Al elegir el tipo de servicio: la descripción se completa si está vacía y, en
  // modo manual, se propone su precio estandarizado cuando el servicio tiene uno.
  const applyServiceType = useCallback(
    (index: number, serviceTypeId: string | undefined, isManual: boolean) => {
      const service = options.serviceTypes.find((s) => s.id === serviceTypeId);
      if (!service) return;
      if (!form.getValues(`lines.${index}.description`)?.trim()) {
        form.setValue(`lines.${index}.description`, service.name, { shouldDirty: true });
      }
      if (!isManual || service.price === null) return;
      form.setValue(`lines.${index}.manualPrice`, String(service.price), {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (!form.getValues(`lines.${index}.lineModeReason`)?.trim()) {
        form.setValue(`lines.${index}.lineModeReason`, "Precio estandarizado", {
          shouldDirty: true,
        });
      }
    },
    [form, options.serviceTypes]
  );

  return (
    <div className="space-y-3">
      <SectionTitle icon={Settings2} title="Equipos y servicios" />
      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="rounded-lg border border-border bg-muted/20 p-3 space-y-3"
          >
            <div className="grid grid-cols-12 gap-2">
              <FormField
                control={form.control}
                name={`lines.${index}.elevatorUnityId`}
                render={({ field: f }) => {
                  const selectedEquipment = f.value
                    ? equipmentById.get(f.value)
                    : undefined;
                  const equipmentOptions =
                    selectedEquipment &&
                    !filteredEquipment.some((e) => e.id === selectedEquipment.id)
                      ? [...filteredEquipment, selectedEquipment]
                      : filteredEquipment;
                  return (
                    <FormItem className="col-span-12 sm:col-span-4">
                      <FormLabel className="text-[10px] text-muted-foreground">
                        Seleccione el Equipo
                      </FormLabel>
                      <FormControl>
                        <Select value={f.value} onValueChange={f.onChange}>
                          <SelectTrigger className="w-full bg-background border-border text-xs">
                            <SelectValue
                              placeholder={
                                equipmentScope && equipmentOptions.length === 0
                                  ? "Sin equipos para esta sede"
                                  : "Equipo (opcional)"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {equipmentOptions.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {[e.internalCode, e.name].filter(Boolean).join(" — ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name={`lines.${index}.serviceTypeId`}
                render={({ field: f }) => (
                  <FormItem className="col-span-12 sm:col-span-4">
                    <FormLabel className="text-[10px] text-muted-foreground">
                      Tipo de Servicio
                    </FormLabel>
                    <FormControl>
                      <SearchableSelect
                        items={options.serviceTypes.filter(
                          (s) => s.showInQuotations || s.id === f.value
                        )}
                        value={f.value ?? ""}
                        onValueChange={(v) => {
                          f.onChange(v);
                          applyServiceType(index, v, lineModes[index] === "MANUAL_PRICE");
                        }}
                        getValue={serviceTypeValue}
                        getLabel={serviceTypeLabel}
                        getKeywords={serviceTypeKeywords}
                        renderItem={(s) =>
                          s.price === null ? s.name : `${s.name} — ${money(s.price)}`
                        }
                        placeholder="Tipo de servicio (opcional)"
                        searchPlaceholder="Buscar tipo de servicio..."
                        emptyText="No hay tipos de servicio habilitados para cotizaciones"
                        allowClear
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`lines.${index}.lineMode`}
                render={({ field: f }) => (
                  <FormItem className="col-span-8 sm:col-span-2">
                    <FormLabel className="text-[10px] text-muted-foreground">
                      Modo de cobro
                    </FormLabel>
                    <FormControl>
                      <Select
                        value={f.value}
                        onValueChange={(v) => {
                          f.onChange(v);
                          if (v === "MANUAL_PRICE") {
                            form.setValue(`lines.${index}.lineOverridePrice`, "");
                            form.setValue(`lines.${index}.lineOverrideReason`, "");
                            form.setValue(`lines.${index}.overridePrice`, false);
                            applyServiceType(
                              index,
                              form.getValues(`lines.${index}.serviceTypeId`),
                              true
                            );
                          } else {
                            form.setValue(`lines.${index}.manualPrice`, "");
                            form.setValue(`lines.${index}.supplierName`, "");
                            form.setValue(`lines.${index}.supplierCost`, "");
                            form.setValue(`lines.${index}.lineModeReason`, "");
                          }
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
              <div className="col-span-4 sm:col-span-2 flex justify-end gap-1">
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
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            {lineModes[index] === "MANUAL_PRICE" ? (
              <div className="space-y-2.5 rounded-md border border-border/70 bg-background/60 p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Modo precio manual
                </p>
                <FormField
                  control={form.control}
                  name={`lines.${index}.description`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormControl>
                         <Textarea
                           rows={2}
                           placeholder="Descripción del servicio (ej: Cambio de tarjeta)"
                           {...f}
                            className="min-h-[96px] resize-y bg-background border-border text-xs"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-12 gap-2 items-start">
                  <FormField
                    control={form.control}
                    name={`lines.${index}.manualPrice`}
                    render={({ field: f }) => (
                      <FormItem className="col-span-6 sm:col-span-4">
                        <FormLabel className="text-[10px] text-muted-foreground">
                          Precio final (S/)
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
                    name={`lines.${index}.manualPriceIncludesIgv`}
                    render={({ field: f }) => (
                      <FormItem className="col-span-6 sm:col-span-3">
                        <FormLabel
                          aria-hidden
                          className="invisible text-[10px] text-muted-foreground"
                        >
                          IGV
                        </FormLabel>
                        <FormControl>
                          <label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-2.5 text-[11px] transition-colors hover:bg-accent/40">
                            <Checkbox
                              checked={!!f.value}
                              onCheckedChange={(v) => f.onChange(v === true)}
                            />
                            Incluye IGV
                          </label>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`lines.${index}.lineModeReason`}
                    render={({ field: f }) => (
                      <FormItem className="col-span-12 sm:col-span-5">
                        <FormLabel className="text-[10px] text-muted-foreground">
                          Motivo
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: servicio externo"
                            {...f}
                            className="bg-background border-border text-xs"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="rounded-md border border-dashed border-border bg-muted/20 p-2.5 space-y-2">
                   <label className="flex cursor-pointer items-center justify-between gap-3 text-xs font-semibold">
                     <span>
                       <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Proveedor externo</span>
                       <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">Opcional para cálculo pass-through</span>
                     </span>
                     <Checkbox
                       checked={expandedProviders[index] ?? Boolean(currentLines?.[index]?.supplierName || Number(currentLines?.[index]?.supplierCost) > 0)}
                       onCheckedChange={(value) => {
                         setExpandedProviders((current) => ({ ...current, [index]: value === true }));
                         if (value !== true) {
                           form.setValue(`lines.${index}.supplierName`, "");
                           form.setValue(`lines.${index}.supplierCost`, "");
                         }
                       }}
                     />
                   </label>
                   {(expandedProviders[index] ?? Boolean(currentLines?.[index]?.supplierName || Number(currentLines?.[index]?.supplierCost) > 0)) && <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`lines.${index}.supplierName`}
                      render={({ field: f }) => (
                         <FormItem>
                          <FormLabel className="text-[10px] text-muted-foreground">
                            Proveedor
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ej: Juan Pérez"
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
                      name={`lines.${index}.supplierCost`}
                      render={({ field: f }) => (
                         <FormItem>
                          <FormLabel className="text-[10px] text-muted-foreground">
                            Costo del proveedor (S/)
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
                   </div>}
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-gray-50/70 p-3 text-right text-[11px] dark:bg-gray-800/50">
                  <div className="text-left">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Valor cliente
                    </div>
                    <div className="font-medium">
                      {money(summary.byLine.get(index)?.clientValue ?? 0)}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      IGV {Math.round(options.pricing.igvRate * 100)}%
                    </div>
                    <div className="font-medium">
                      {money(summary.byLine.get(index)?.igv ?? 0)}
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center justify-between border-t border-border pt-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Total
                    </div>
                     <div className="text-base font-extrabold text-[#0066CC]">
                      {money(summary.byLine.get(index)?.clientPrice ?? 0)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-12 gap-2 items-start">
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
                </div>

                <FormField
                  control={form.control}
                  name={`lines.${index}.description`}
                  render={({ field: f }) => (
                    <FormItem>
                      <FormControl>
                         <Textarea
                           rows={2}
                           placeholder="Descripción del servicio (ej: Mantenimiento preventivo semestral)"
                           {...f}
                           className="min-h-[96px] resize-y bg-background border-border text-xs"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <LineProductsField control={form.control} lineIndex={index} />

                <div className="rounded-md border border-dashed border-border bg-muted/20 p-2.5 space-y-2">
                  <FormField
                    control={form.control}
                    name={`lines.${index}.overridePrice`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormControl>
                          <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                            <Checkbox
                              checked={!!f.value}
                              onCheckedChange={(v) => {
                                f.onChange(v === true);
                                if (v !== true) {
                                  form.setValue(`lines.${index}.lineOverridePrice`, "");
                                  form.setValue(
                                    `lines.${index}.lineOverrideReason`,
                                    ""
                                  );
                                }
                              }}
                            />
                            Sobrescribir precio de esta línea
                          </label>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {currentLines?.[index]?.overridePrice && (
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <FormField
                        control={form.control}
                        name={`lines.${index}.lineOverridePrice`}
                        render={({ field: f }) => (
                          <FormItem className="col-span-6 sm:col-span-4">
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
                          <FormItem className="col-span-6 sm:col-span-8">
                            <FormLabel className="text-[10px] text-muted-foreground">
                              Motivo
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
                    </div>
                  )}
                </div>
              </div>
            )}
            {(summary.byLine.get(index)?.discountAmount ?? 0) > 0 && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Precio con descuento de línea de{" "}
                {money(summary.byLine.get(index)?.discountAmount ?? 0)} (precio de lista{" "}
                {money(summary.byLine.get(index)?.listPrice ?? 0)}). Se edita en el tab
                Descuento.
              </p>
            )}
          </div>
        ))}
        {fields.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            Esta cotización aún no tiene líneas. Agrega el primer equipo o servicio.
          </div>
        )}
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
  );
}
