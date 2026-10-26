"use client";

import { useMemo } from "react";
import { useWatch } from "react-hook-form";
import type { QuotationFormOptions } from "../actions";
import { DISCOUNT_MODES, LINE_DISCOUNT_MODES } from "../calc";
import { money, SectionTitle, useQuotationSummary, type QuotationForm } from "./quotation-form-shared";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pill, Tag } from "lucide-react";

/** Tab "Descuento": descuento por línea, descuento general y resumen de totales. */
export function QuotationDiscountEditor({
  form,
  options,
}: {
  form: QuotationForm;
  options: QuotationFormOptions;
}) {
  const { currentLines, summary } = useQuotationSummary(form, options.pricing);
  const discountMode = useWatch({ control: form.control, name: "discountMode" });
  const targetTotalIncludesIgv = useWatch({
    control: form.control,
    name: "targetTotalIncludesIgv",
  });
  const showTaxBreakdown = useWatch({ control: form.control, name: "showTaxBreakdown" });

  const equipmentById = useMemo(
    () => new Map(options.equipment.map((e) => [e.id, e])),
    [options.equipment]
  );
  const lines = currentLines ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionTitle icon={Tag} title="Descuento por línea" />
        {lines.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            Agrega líneas en el tab Líneas de Cotización para aplicarles un descuento.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-muted/20">
            {lines.map((line, index) => {
              const calc = summary.byLine.get(index);
              const lineDiscountMode = line.discountMode ?? "NONE";
              const equipment = line.elevatorUnityId
                ? equipmentById.get(line.elevatorUnityId)
                : undefined;
              return (
                <div key={index} className="grid grid-cols-12 items-start gap-x-2 gap-y-3 p-3">
                  <div className="col-span-12 min-w-0 sm:col-span-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Ítem {String(index + 1).padStart(2, "0")}
                      {equipment?.internalCode ? ` · ${equipment.internalCode}` : ""}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-xs">
                      {line.description?.trim() || "Sin descripción"}
                    </div>
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <div className="text-[10px] text-muted-foreground">Precio de lista</div>
                    <div className="flex h-8 items-center text-xs font-medium">
                      {money(calc?.listPrice ?? 0)}
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name={`lines.${index}.discountMode`}
                    render={({ field: f }) => (
                      <FormItem className="col-span-6 sm:col-span-2">
                        <FormLabel className="text-[10px] text-muted-foreground">
                          Descuento
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={f.value ?? "NONE"}
                            onValueChange={(v) => {
                              f.onChange(v);
                              if (v === "NONE") {
                                form.setValue(`lines.${index}.discountValue`, "", {
                                  shouldDirty: true,
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="w-full bg-background border-border text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LINE_DISCOUNT_MODES.map((m) => (
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
                  <FormField
                    control={form.control}
                    name={`lines.${index}.discountValue`}
                    render={({ field: f }) => (
                      <FormItem className="col-span-6 sm:col-span-2">
                        <FormLabel className="text-[10px] text-muted-foreground">
                          {lineDiscountMode === "AMOUNT" ? "Monto (S/ con IGV)" : "Valor (%)"}
                        </FormLabel>
                        <FormControl>
                          <Input
                            inputMode="decimal"
                            placeholder={lineDiscountMode === "NONE" ? "—" : "0"}
                            disabled={lineDiscountMode === "NONE"}
                            {...f}
                            value={f.value ?? ""}
                            className="bg-background border-border text-xs"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="col-span-6 text-right sm:col-span-2">
                    <div className="text-[10px] text-muted-foreground">Precio final</div>
                    <div className="text-sm font-bold">{money(calc?.clientPrice ?? 0)}</div>
                    {(calc?.discountAmount ?? 0) > 0 && (
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                        -{money(calc?.discountAmount ?? 0)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Los precios por línea incluyen IGV. El descuento de cada línea se muestra en el PDF junto
          a su precio de lista.
        </p>
      </div>

      <div className="space-y-3">
        <SectionTitle icon={Pill} title="Descuento general" />
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
        </div>
      </div>
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Resumen de cálculo
        </div>
        {summary.lineDiscountTotal > 0 && (
          <p className="mb-3 text-[11px] text-muted-foreground">
            El subtotal ya descuenta {money(summary.lineDiscountTotal)} (con IGV) en
            descuentos por línea.
          </p>
        )}
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
        <label className="mt-4 flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={showTaxBreakdown ?? true}
            onChange={(e) =>
              form.setValue("showTaxBreakdown", e.target.checked, {
                shouldDirty: true,
                shouldTouch: true,
              })
            }
            className="size-4 accent-[#0066CC]"
          />
          <span>Mostrar desglose (Subtotal, Base, IGV) en el PDF</span>
        </label>
      </div>
    </div>
  );
}
