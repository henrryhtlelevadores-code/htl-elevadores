"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { type ElevatorType } from "@/db";
import { elevatorTypeFormSchema, type ElevatorTypeFormValues } from "../schema";
import { createElevatorType, updateElevatorType, deleteElevatorType } from "../actions";
import { DataTable } from "@/components/ui/data-table";

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
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Cpu,
  AlertTriangle,
  ArrowUpDown,
} from "lucide-react";

interface TypesTabProps {
  initialTypes: ElevatorType[];
}

export function TypesTab({ initialTypes }: TypesTabProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingType, setEditingType] = useState<ElevatorType | null>(null);
  const [deletingType, setDeletingType] = useState<ElevatorType | null>(null);
  const [isPending, startTransition] = useTransition();

  const createForm = useForm<ElevatorTypeFormValues>({
    resolver: zodResolver(elevatorTypeFormSchema),
    defaultValues: { name: "" },
  });

  const editForm = useForm<{ name: string }>({
    defaultValues: { name: "" },
  });

  function handleOpenCreate() {
    createForm.reset({ name: "" });
    setIsCreateOpen(true);
  }

  function handleOpenEdit(type: ElevatorType) {
    setEditingType(type);
    editForm.reset({ name: type.name });
  }

  function handleCreateSubmit(values: ElevatorTypeFormValues) {
    startTransition(async () => {
      const res = await createElevatorType(values);
      if (res.success) {
        toast.success("Tipo registrado", {
          description: `El tipo "${values.name}" ha sido creado.`,
        });
        setIsCreateOpen(false);
        createForm.reset();
      } else {
        toast.error("Error al crear tipo", { description: res.error });
      }
    });
  }

  function handleEditSubmit(values: { name: string }) {
    if (!editingType) return;
    startTransition(async () => {
      const res = await updateElevatorType(editingType.id, { name: values.name });
      if (res.success) {
        toast.success("Tipo actualizado", {
          description: `Los cambios se guardaron exitosamente.`,
        });
        setEditingType(null);
      } else {
        toast.error("Error al actualizar", { description: res.error });
      }
    });
  }

  function handleDeleteConfirm() {
    if (!deletingType) return;
    startTransition(async () => {
      const res = await deleteElevatorType(deletingType.id);
      if (res.success) {
        toast.success("Tipo eliminado", {
          description: `Se ha retirado "${deletingType.name}".`,
        });
        setDeletingType(null);
      } else {
        toast.error("Error al eliminar", { description: res.error });
      }
    });
  }

  const columns = useMemo<ColumnDef<ElevatorType>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-xs font-semibold hover:bg-muted/60"
          >
            Tipo de Elevación
            <ArrowUpDown className="ml-1.5 size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Cpu className="size-3.5 text-[#0066CC] shrink-0" />
            <span className="font-semibold">{row.getValue("name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Estado",
        cell: ({ row }) => {
          const active = row.getValue<boolean>("isActive");
          return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-border bg-muted/50">
              <span className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-zinc-400"}`} />
              {active ? "Activo" : "Inactivo"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => {
          const type = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleOpenEdit(type)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Editar tipo"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeletingType(type)}
                className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                title="Eliminar tipo"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={initialTypes}
        searchPlaceholder="Buscar por tipo..."
        extraActions={
          <Button
            onClick={handleOpenCreate}
            className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs shrink-0"
          >
            <Plus className="size-4" />
            Nuevo Tipo
          </Button>
        }
      />

      {/* Modal: Crear Tipo */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="size-4 text-[#0066CC]" />
              Nuevo Tipo de Elevación
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ej: Ascensor de Pasajeros, Montacargas, Escalera Mecánica.
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4 pt-2">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Nombre del Tipo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Ascensor de Pasajeros"
                        {...field}
                        className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
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
                  Guardar Tipo
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Tipo */}
      <Dialog open={!!editingType} onOpenChange={(open) => !open && setEditingType(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[425px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="size-4 text-[#0066CC]" />
              Editar Tipo de Elevación
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modifica el nombre del tipo.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEditSubmit({ name: editForm.getValues("name") });
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-2">
              <label className="text-xs font-semibold">Nombre del Tipo</label>
              <Input
                defaultValue={editingType?.name}
                onChange={(e) => editForm.setValue("name", e.target.value)}
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingType(null)}
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
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Eliminación */}
      <Dialog open={!!deletingType} onOpenChange={(open) => !open && setDeletingType(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              Eliminar Tipo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Estás seguro de que deseas eliminar el tipo{" "}
              <strong className="text-foreground">{deletingType?.name}</strong>?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingType(null)}
              className="text-xs border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleDeleteConfirm}
              className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold gap-2"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Eliminar Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}