"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { type Client, type CostCenter } from "@/db";
import { createCostCenter, updateCostCenter, deleteCostCenter } from "../actions";
import { costCenterFormSchema, type CostCenterFormValues } from "../schema";
import { DataTable } from "@/components/ui/data-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Pencil, Trash2, Loader2, MapPin, AlertTriangle, ArrowUpDown, Eye } from "lucide-react";

interface CostCentersTableProps {
  client: Client;
  costCenters: CostCenter[];
  onSelectCostCenter?: (center: CostCenter) => void;
}

export function CostCentersTable({ client, costCenters, onSelectCostCenter }: CostCentersTableProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);
  const [deletingCenter, setDeletingCenter] = useState<CostCenter | null>(null);
  const [isPending, startTransition] = useTransition();

  const createForm = useForm<CostCenterFormValues>({
    resolver: zodResolver(costCenterFormSchema),
    defaultValues: { clientId: client.id, name: "", address: "", district: "" },
  });

  const editForm = useForm<{ name: string; address: string; district: string }>({
    defaultValues: { name: "", address: "", district: "" },
  });

  function handleOpenCreate() {
    createForm.reset({ clientId: client.id, name: "", address: "", district: "" });
    setIsCreateOpen(true);
  }

  function handleOpenEdit(center: CostCenter) {
    setEditingCenter(center);
    editForm.reset({
      name: center.name,
      address: center.address || "",
      district: center.district || "",
    });
  }

  function handleCreateSubmit(values: CostCenterFormValues) {
    startTransition(async () => {
      const res = await createCostCenter(values);
      if (res.success) {
        toast.success("Sede registrada", { description: `La sede "${values.name}" fue creada.` });
        setIsCreateOpen(false);
        createForm.reset();
      } else {
        toast.error("Error al crear sede", { description: res.error });
      }
    });
  }

  function handleEditSubmit(values: { name: string; address: string; district: string }) {
    if (!editingCenter) return;
    startTransition(async () => {
      const res = await updateCostCenter(editingCenter.id, values);
      if (res.success) {
        toast.success("Sede actualizada", { description: "Los cambios se guardaron." });
        setEditingCenter(null);
      } else {
        toast.error("Error al actualizar", { description: res.error });
      }
    });
  }

  function handleDeleteConfirm() {
    if (!deletingCenter) return;
    startTransition(async () => {
      const res = await deleteCostCenter(deletingCenter.id);
      if (res.success) {
        toast.success("Sede eliminada", { description: `Se eliminó "${deletingCenter.name}".` });
        setDeletingCenter(null);
      } else {
        toast.error("Error al eliminar", { description: res.error });
      }
    });
  }

  const columns = useMemo<ColumnDef<CostCenter>[]>(
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
            Nombre de Sede
            <ArrowUpDown className="ml-1.5 size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2 text-foreground">
            <MapPin className="size-3.5 text-[#0066CC] shrink-0" />
            <span className="font-semibold">{row.getValue("name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "address",
        header: "Dirección",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground max-w-[260px] truncate block">
            {row.getValue<string>("address")}
          </span>
        ),
      },
      {
        accessorKey: "district",
        header: "Distrito",
        cell: ({ row }) => {
          const district = row.getValue<string | null>("district");
          return <span className="text-xs text-muted-foreground">{district || "—"}</span>;
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => {
          const center = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onSelectCostCenter?.(center)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Ver contactos de la sede"
              >
                <Eye className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleOpenEdit(center)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Editar sede"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeletingCenter(center)}
                className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                title="Eliminar sede"
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
        data={costCenters}
        searchPlaceholder="Buscar por sede o dirección..."
        extraActions={
          <Button
            onClick={handleOpenCreate}
            className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs shrink-0"
          >
            <Plus className="size-4" />
            Nueva Sede
          </Button>
        }
      />

      {/* Modal: Crear Sede */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="size-4 text-[#0066CC]" />
              Nueva Sede / Centro de Costo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Registra un nuevo centro de costo para {client.legalName}.
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4 pt-2">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Nombre de la Sede</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Torre Principal" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Dirección</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Av. La Marina 1455" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Distrito</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: San Miguel" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)} className="text-xs border-border">
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2">
                  {isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Guardar Sede
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Sede */}
      <Dialog open={!!editingCenter} onOpenChange={(open) => !open && setEditingCenter(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[425px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="size-4 text-[#0066CC]" />
              Editar Sede
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEditSubmit({
                name: editForm.getValues("name"),
                address: editForm.getValues("address"),
                district: editForm.getValues("district"),
              });
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-2">
              <label className="text-xs font-semibold">Nombre de la Sede</label>
              <Input
                defaultValue={editingCenter?.name}
                onChange={(e) => editForm.setValue("name", e.target.value)}
                required
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Dirección</label>
              <Input
                defaultValue={editingCenter?.address}
                onChange={(e) => editForm.setValue("address", e.target.value)}
                required
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Distrito</label>
              <Input
                defaultValue={editingCenter?.district || ""}
                onChange={(e) => editForm.setValue("district", e.target.value)}
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingCenter(null)} className="text-xs border-border">
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isPending} className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2">
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Eliminación */}
      <Dialog open={!!deletingCenter} onOpenChange={(open) => !open && setDeletingCenter(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              Eliminar Sede
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Estás seguro de eliminar la sede{" "}
              <strong className="text-foreground">{deletingCenter?.name}</strong>?
              Si tiene equipos vinculados no podrá eliminarse.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDeletingCenter(null)} className="text-xs border-border">
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={isPending} onClick={handleDeleteConfirm} className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold gap-2">
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Eliminar Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}