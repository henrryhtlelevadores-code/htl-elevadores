"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { type ServiceType } from "@/db";
import { serviceTypeFormSchema, type ServiceTypeFormValues } from "../schema";
import { createServiceType, updateServiceType, deleteServiceType } from "../actions";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Wrench,
  AlertTriangle,
  ArrowUpDown,
} from "lucide-react";

interface ServiceTypesTabProps {
  initialServiceTypes: ServiceType[];
}

const CATEGORIES = ["MANTENIMIENTO", "MODERNIZACION", "EMERGENCIA", "PROYECTO"] as const;

const createDefaultValues = (): ServiceTypeFormValues => ({
  code: "",
  name: "",
  category: "MANTENIMIENTO",
  requiresContract: false,
  defaultSlaMins: "",
  isBillableByDefault: true,
});

export function ServiceTypesTab({ initialServiceTypes }: ServiceTypesTabProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingType, setEditingType] = useState<ServiceType | null>(null);
  const [deletingType, setDeletingType] = useState<ServiceType | null>(null);
  const [isPending, startTransition] = useTransition();

  const createForm = useForm<ServiceTypeFormValues>({
    resolver: zodResolver(serviceTypeFormSchema),
    defaultValues: createDefaultValues(),
  });

  function handleOpenCreate() {
    createForm.reset(createDefaultValues());
    setIsCreateOpen(true);
  }

  function handleOpenEdit(type: ServiceType) {
    setEditingType(type);
    createForm.reset({
      code: type.code,
      name: type.name,
      category: type.category,
      requiresContract: type.requiresContract ?? false,
      defaultSlaMins: type.defaultSlaMins != null ? type.defaultSlaMins : "",
      isBillableByDefault: type.isBillableByDefault ?? true,
    });
  }

  function handleCreateSubmit(values: ServiceTypeFormValues) {
    startTransition(async () => {
      const res = await createServiceType(values);
      if (res.success) {
        toast.success("Tipo de servicio registrado", {
          description: `El tipo "${values.name}" ha sido creado.`,
        });
        setIsCreateOpen(false);
        createForm.reset();
      } else {
        toast.error("Error al crear tipo de servicio", { description: res.error });
      }
    });
  }

  function handleEditSubmit(values: ServiceTypeFormValues) {
    if (!editingType) return;
    startTransition(async () => {
      const res = await updateServiceType(editingType.id, values);
      if (res.success) {
        toast.success("Tipo de servicio actualizado", {
          description: "Los cambios se guardaron exitosamente.",
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
      const res = await deleteServiceType(deletingType.id);
      if (res.success) {
        toast.success("Tipo de servicio eliminado", {
          description: `Se ha retirado "${deletingType.name}".`,
        });
        setDeletingType(null);
      } else {
        toast.error("Error al eliminar", { description: res.error });
      }
    });
  }

  const columns = useMemo<ColumnDef<ServiceType>[]>(
    () => [
      {
        accessorKey: "code",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-xs font-semibold hover:bg-muted/60"
          >
            Código
            <ArrowUpDown className="ml-1.5 size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border border-border">
            {row.getValue("code")}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Tipo de Servicio",
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Wrench className="size-3.5 text-[#0066CC] shrink-0" />
            <span className="font-semibold">{row.getValue("name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "category",
        header: "Categoría",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.getValue("category")}</span>
        ),
      },
      {
        accessorKey: "requiresContract",
        header: "Requiere Contrato",
        cell: ({ row }) => {
          const requires = row.getValue<boolean>("requiresContract");
          return (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${requires ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted/50 text-muted-foreground border-border"}`}>
              {requires ? "Sí" : "No"}
            </span>
          );
        },
      },
      {
        accessorKey: "defaultSlaMins",
        header: "SLA (min)",
        cell: ({ row }) => {
          const sla = row.getValue<number | null>("defaultSlaMins");
          return <span className="text-xs font-mono text-muted-foreground">{sla ?? "—"}</span>;
        },
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
                title="Editar tipo de servicio"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeletingType(type)}
                className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                title="Eliminar tipo de servicio"
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
        data={initialServiceTypes}
        searchPlaceholder="Buscar por código, nombre o categoría..."
        extraActions={
          <Button
            onClick={handleOpenCreate}
            className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs shrink-0"
          >
            <Plus className="size-4" />
            Nuevo Tipo de Servicio
          </Button>
        }
      />

      {/* Modal: Crear Tipo de Servicio */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[500px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="size-4 text-[#0066CC]" />
              Nuevo Tipo de Servicio
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ej: Mantenimiento Preventivo, Correctivo - Reparación, Modernización.
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Código</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: PREV"
                          {...field}
                          className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Categoría</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
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

              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Nombre del Servicio</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Mantenimiento Preventivo"
                        {...field}
                        className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="requiresContract"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Requiere Contrato</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ? "true" : "false"}
                          onValueChange={(v) => field.onChange(v === "true")}
                        >
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Sí</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="defaultSlaMins"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">SLA Estándar (min)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Ej: 180"
                          {...field}
                          className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="isBillableByDefault"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Facturable por Defecto</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ? "true" : "false"}
                        onValueChange={(v) => field.onChange(v === "true")}
                      >
                        <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Sí</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
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

      {/* Modal: Editar Tipo de Servicio */}
      <Dialog open={!!editingType} onOpenChange={(open) => !open && setEditingType(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[500px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="size-4 text-[#0066CC]" />
              Editar Tipo de Servicio
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modifica los datos del tipo de servicio.
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleEditSubmit)} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Código</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Categoría</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
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

              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Nombre del Servicio</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="requiresContract"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Requiere Contrato</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ? "true" : "false"}
                          onValueChange={(v) => field.onChange(v === "true")}
                        >
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Sí</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="defaultSlaMins"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">SLA Estándar (min)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="isBillableByDefault"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Facturable por Defecto</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ? "true" : "false"}
                        onValueChange={(v) => field.onChange(v === "true")}
                      >
                        <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Sí</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
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
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Eliminación */}
      <Dialog open={!!deletingType} onOpenChange={(open) => !open && setDeletingType(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              Eliminar Tipo de Servicio
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