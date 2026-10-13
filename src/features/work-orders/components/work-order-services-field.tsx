"use client";

import { useFieldArray, type UseFormReturn } from "react-hook-form";
import type { ServiceTypeOption } from "../actions";
import type { WorkOrderFormValues } from "../schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Trash2 } from "lucide-react";

const typeValue = (type: ServiceTypeOption) => type.id;
const typeLabel = (type: ServiceTypeOption) => type.name;
const typeKeywords = (type: ServiceTypeOption) => type.code;

export const emptyServiceItem = (serviceTypeId = "") => ({
  serviceTypeId,
  locationDescription: "",
  description: "",
  tasks: "",
});

/**
 * Servicios generales que atiende la OT (reemplaza a la lista de equipos cuando
 * el tipo de servicio es de Servicios Generales).
 */
export function WorkOrderServicesField({
  form,
  generalServiceTypes,
  defaultServiceTypeId,
}: {
  form: UseFormReturn<WorkOrderFormValues>;
  /** Tipos de servicio con alcance GENERAL. */
  generalServiceTypes: ServiceTypeOption[];
  /** Tipo de servicio de la OT: es el que propone cada servicio nuevo. */
  defaultServiceTypeId: string;
}) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "services" });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Servicios a realizar</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => append(emptyServiceItem(defaultServiceTypeId))}
        >
          <Plus className="size-3.5" />
          Agregar servicio
        </Button>
      </div>

      {fields.length === 0 && (
        <div className="rounded-md border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
          Agrega al menos un servicio (por ejemplo: limpieza de baños, jardinería exterior).
        </div>
      )}

      {fields.map((item, index) => (
        <div key={item.id} className="space-y-2 rounded-md border border-border bg-muted/20 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Servicio {index + 1}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-7 h-7 text-muted-foreground hover:text-destructive"
              aria-label={`Quitar servicio ${index + 1}`}
              onClick={() => remove(index)}
              disabled={fields.length <= 1}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FormField
              control={form.control}
              name={`services.${index}.serviceTypeId`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] text-muted-foreground">Tipo</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      items={generalServiceTypes}
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                      getValue={typeValue}
                      getLabel={typeLabel}
                      getKeywords={typeKeywords}
                      placeholder="Tipo de servicio"
                      searchPlaceholder="Buscar tipo..."
                      emptyText="Sin tipos de Servicios Generales"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`services.${index}.locationDescription`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] text-muted-foreground">
                    Ubicación en la sede
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Ej: Baños piso 1"
                      className="bg-background border-border text-xs"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name={`services.${index}.description`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] text-muted-foreground">
                  Qué se debe hacer
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={2}
                    placeholder="Ej: Limpieza profunda de oficinas administrativas"
                    className="min-h-14 bg-background border-border text-xs"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`services.${index}.tasks`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] text-muted-foreground">
                  Tareas (una por línea, opcional)
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    rows={3}
                    placeholder={"Barrer y trapear\nLimpiar vidrios\nRetirar residuos"}
                    className="min-h-16 bg-background border-border text-xs"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      ))}
    </div>
  );
}
