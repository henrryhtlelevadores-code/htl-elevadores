"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createMaintenanceModule,
  updateMaintenanceModule,
  type MaintenanceModuleWithCount,
} from "../actions";
import {
  maintenanceModuleFormSchema,
  type MaintenanceModuleFormValues,
} from "../schema";
import { MONTH_LABELS } from "../constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { type ElevatorType } from "@/db";

const inputClass =
  "bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]";

interface ModuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: MaintenanceModuleWithCount | null;
  onSaved: () => void;
  elevatorTypes: ElevatorType[];
}

export function ModuleFormDialog({
  open,
  onOpenChange,
  module,
  onSaved,
  elevatorTypes,
}: ModuleFormDialogProps) {
  const isEditing = !!module;
  const [isPending, startTransition] = useTransition();

  const form = useForm<MaintenanceModuleFormValues>({
    resolver: zodResolver(maintenanceModuleFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      monthsOfYear: Array.from({ length: 12 }, (_, index) => index + 1),
      elevatorTypeId: elevatorTypes[0]?.id ?? "",
      isActive: true,
    },
  });

  // Con tareas cargadas el tipo de equipo queda fijo: cambiarlo rompería el catálogo.
  const typeLocked = isEditing && (module?.taskCount ?? 0) > 0;

  useEffect(() => {
    if (!open) return;
    form.reset(
      module
        ? {
            code: module.code,
            name: module.name,
            description: module.description ?? "",
             monthsOfYear: (module.monthsOfYear ?? "").split(",").filter(Boolean).map(Number),
            elevatorTypeId: module.elevatorTypeId ?? elevatorTypes[0]?.id ?? "",
            isActive: module.isActive ?? true,
          }
        : {
            code: "",
            name: "",
            description: "",
             monthsOfYear: Array.from({ length: 12 }, (_, index) => index + 1),
            elevatorTypeId: elevatorTypes[0]?.id ?? "",
            isActive: true,
          }
    );
  }, [open, module, form]);

  function onSubmit(values: MaintenanceModuleFormValues) {
    startTransition(async () => {
      const res = module
        ? await updateMaintenanceModule(module.id, values)
        : await createMaintenanceModule(values);
      if (res.success) {
        toast.success(isEditing ? "Módulo actualizado" : "Módulo creado", {
          description: res.message,
        });
        onOpenChange(false);
        onSaved();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[480px] text-foreground shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            {isEditing ? `Editar ${module.code}` : "Nuevo Módulo"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Define el módulo de mantenimiento y en qué visitas se ejecuta.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <div className="grid grid-cols-[110px_1fr] gap-3">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Código *</FormLabel>
                    <FormControl>
                      <Input placeholder="M1" {...field} className={inputClass} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Nombre *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Inspección básica"
                        {...field}
                        className={inputClass}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Descripción</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Alcance del módulo"
                      {...field}
                      className={inputClass}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="elevatorTypeId" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold">Tipo de Equipo *</FormLabel>
                <FormControl>
                  <select
                    value={field.value}
                    onChange={field.onChange}
                    disabled={typeLocked}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {elevatorTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                </FormControl>
                {typeLocked ? (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    Bloqueado: el módulo tiene {module?.taskCount} tarea
                    {module?.taskCount === 1 ? "" : "s"} asignada
                    {module?.taskCount === 1 ? "" : "s"}. Puedes editar el
                    resto de campos, incluido el calendario.
                  </p>
                ) : (
                  <FormMessage />
                )}
              </FormItem>
            )} />

             <FormField
               control={form.control}
               name="monthsOfYear"
               render={({ field }) => (
                 <FormItem className="space-y-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                   <FormLabel className="text-xs font-semibold">Meses del año *</FormLabel>
                   <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                     {MONTH_LABELS.map((label, index) => {
                       const month = index + 1;
                       const selected = field.value.includes(month);
                       return (
                         <label key={month} className="flex cursor-pointer items-center gap-1.5 text-[11px]">
                           <Checkbox checked={selected} onCheckedChange={(checked) => field.onChange(checked ? [...field.value, month] : field.value.filter((value) => value !== month))} />
                           {label}
                         </label>
                       );
                     })}
                   </div>
                   <FormDescription className="text-[10px]">Selecciona los meses en los que se ejecutará este módulo.</FormDescription>
                   <FormMessage />
                 </FormItem>
               )}
             />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs font-semibold flex items-center gap-2">
                    <Checkbox
                      id="module-active"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                    Módulo activo
                  </FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
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
                {isEditing ? "Guardar Cambios" : "Crear Módulo"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
