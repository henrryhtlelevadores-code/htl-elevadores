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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  IconArrowsSort,
  IconBuildingSkyscraper,
  IconUsers,
  IconShieldCheck,
  IconKey,
  IconChevronRight,
  IconDotsVertical,
  IconPencil,
  IconTrash,
  IconPlus,
  IconLoader2,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { cn } from "cn";

interface CostCentersTableProps {
  client: Client;
  costCenters: CostCenter[];
  contactsCount: Record<string, number>;
  onSelectCostCenter?: (center: CostCenter) => void;
  onManageCredential?: (center: CostCenter) => void;
}

export function CostCentersTable({
  client,
  costCenters,
  contactsCount,
  onSelectCostCenter,
  onManageCredential,
}: CostCentersTableProps) {
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
            className="h-8 px-0 text-xs font-semibold hover:bg-transparent gap-1"
          >
            Nombre de Sede
            <IconArrowsSort className="size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => {
          const center = row.original;
          return (
            <button
              type="button"
              onClick={() => onSelectCostCenter?.(center)}
              className="flex items-center gap-2 text-left text-foreground hover:text-[#0066CC] transition-colors max-w-full"
              title="Gestionar sede"
            >
              <IconBuildingSkyscraper className="size-4 text-[#0066CC] shrink-0" />
              <span className="font-semibold truncate">{row.getValue("name")}</span>
            </button>
          );
        },
      },
      {
        accessorKey: "address",
        header: "Dirección",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground max-w-[240px] truncate block">
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
        id: "contacts",
        header: "Contactos",
        cell: ({ row }) => {
          const center = row.original;
          const count = contactsCount[center.id] || 0;
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                count > 0
                  ? "text-[#0066CC] dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20"
                  : "text-muted-foreground bg-muted/50 border-border"
              )}
            >
              <IconUsers className="size-3.5" />
              {count} {count === 1 ? "contacto" : "contactos"}
            </span>
          );
        },
      },
      {
        id: "credentials",
        header: "Credenciales",
        cell: ({ row }) => {
          const center = row.original;
          const has = Boolean(center.passwordHash);
          return has ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
              <IconShieldCheck className="size-3.5 text-green-600" />
              Configurada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold text-muted-foreground bg-muted/50 border border-border">
              <IconKey className="size-3.5" />
              Sin configurar
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => {
          const center = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelectCostCenter?.(center)}
                className="text-xs border-border gap-1.5 font-semibold text-[#0066CC] dark:text-blue-400 h-8"
              >
                Gestionar
                <IconChevronRight className="size-3.5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Acciones rápidas"
                    />
                  }
                >
                  <IconDotsVertical className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px]">
                  <DropdownMenuItem onClick={() => onSelectCostCenter?.(center)}>
                    <IconBuildingSkyscraper className="size-4 text-[#0066CC]" />
                    Gestionar Sede
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onManageCredential?.(center)}>
                    <IconKey className="size-4 text-amber-600" />
                    Cambiar Contraseña
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenEdit(center)}>
                    <IconPencil className="size-4" />
                    Editar Sede
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDeletingCenter(center)}>
                    <IconTrash className="size-4" />
                    Eliminar Sede
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
            <IconPlus className="size-4" />
            Nueva Sede
          </Button>
        }
      />

      {/* Modal: Crear Sede */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <IconPlus className="size-4 text-[#0066CC]" />
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
                      <Textarea placeholder="Ej: Av. La Marina 1455, piso 8" rows={3} {...field} className="resize-none bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
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
                  {isPending && <IconLoader2 className="size-3.5 animate-spin" />}
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
              <IconPencil className="size-4 text-[#0066CC]" />
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
              <Textarea
                defaultValue={editingCenter?.address}
                onChange={(e) => editForm.setValue("address", e.target.value)}
                rows={3}
                required
                className="resize-none bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
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
                {isPending && <IconLoader2 className="size-3.5 animate-spin" />}
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
              <IconAlertTriangle className="size-4 text-red-600 dark:text-red-400" />
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
              {isPending && <IconLoader2 className="size-3.5 animate-spin" />}
              Eliminar Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}