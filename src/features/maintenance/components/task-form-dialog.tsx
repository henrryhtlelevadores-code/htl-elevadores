"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createMaintenanceTask,
  updateMaintenanceTask,
  type MaintenanceTaskWithModule,
} from "../actions";
import { type MaintenanceZone } from "../constants";
import {
  maintenanceTaskFormSchema,
  type MaintenanceTaskFormValues,
} from "../schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Camera, Loader2, ShieldAlert } from "lucide-react";

const inputClass =
  "bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]";

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  /** Zona preelegida (botón "+ Agregar tarea en <zona>"). */
  defaultZone: MaintenanceZone;
  task: MaintenanceTaskWithModule | null;
  onSaved: () => void;
  zoneTaskCounts: Partial<Record<MaintenanceZone, number>>;
  zones: Array<{ id: string; name: string }>;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  moduleId,
  defaultZone,
  task,
  onSaved,
  zoneTaskCounts,
  zones,
}: TaskFormDialogProps) {
  const isEditing = !!task;
  const [isPending, startTransition] = useTransition();

  const form = useForm<MaintenanceTaskFormValues>({
    resolver: zodResolver(maintenanceTaskFormSchema),
    defaultValues: {
      zoneId: defaultZone,
      description: "",
      isCritical: false,
      requiresPhoto: false,
    },
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      form.reset(
        task
          ? {
              zoneId: task.zoneId ?? defaultZone,
              description: task.description,
              isCritical: task.isCritical ?? false,
              requiresPhoto: task.requiresPhoto ?? false,
            }
          : {
              zoneId: defaultZone,
              description: "",
              isCritical: false,
              requiresPhoto: false,
            }
      );
    }
    onOpenChange(next);
  }

  function onSubmit(values: MaintenanceTaskFormValues) {
    startTransition(async () => {
      const res = task
        ? await updateMaintenanceTask(task.id, values)
        : await createMaintenanceTask(moduleId, values);
      if (res.success) {
        toast.success(isEditing ? "Tarea actualizada" : "Tarea creada", {
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg text-foreground shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            {isEditing ? "Editar Tarea" : "Nueva Tarea"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isEditing
              ? "Modifica la tarea del módulo."
              : "El orden se asigna automáticamente al final de la zona."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <FormField
              control={form.control}
              name="zoneId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Zona *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className={inputClass + " w-full"}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.map((zone) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <p className="text-[10px] text-muted-foreground">
                    Se agregará al final de la zona ({zoneTaskCounts[field.value] ?? 0} tareas actuales).
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold">Descripción *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ej: Comprobar el estado de las poleas bajo la cabina, verificar tensión de cables y desgaste de guías."
                      rows={5}
                      maxLength={500}
                      {...field}
                      className={inputClass + " resize-none"}
                    />
                  </FormControl>
                  <p className="text-[10px] text-muted-foreground text-right">
                    {field.value.length} / 500 caracteres
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3 pt-1">
              <FormField
                control={form.control}
                name="isCritical"
                render={({ field }) => (
                  <FormItem className="rounded-lg border border-border p-3">
                    <FormLabel className="flex cursor-pointer items-start gap-3">
                      <Checkbox
                        id="task-critical"
                        checked={field.value}
                        onCheckedChange={(c) => field.onChange(c === true)}
                      />
                      <div>
                        <span className="flex items-center gap-1.5 text-xs font-semibold">
                          <ShieldAlert className="size-3.5 text-red-500" />
                          Tarea crítica
                        </span>
                        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                          Bloqueará el cierre de la OT si no está completada.
                        </p>
                      </div>
                    </FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="requiresPhoto"
                render={({ field }) => (
                  <FormItem className="rounded-lg border border-border p-3">
                    <FormLabel className="flex cursor-pointer items-start gap-3">
                      <Checkbox
                        id="task-photo"
                        checked={field.value}
                        onCheckedChange={(c) => field.onChange(c === true)}
                      />
                      <div>
                        <span className="flex items-center gap-1.5 text-xs font-semibold">
                          <Camera className="size-3.5 text-[#0066CC]" />
                          Requiere foto
                        </span>
                        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                          El técnico deberá adjuntar al menos una foto como evidencia.
                        </p>
                      </div>
                    </FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                {isEditing ? "Guardar Cambios" : "Crear Tarea"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
