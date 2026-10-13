"use client";

import { useMemo, useState } from "react";
import { useSubmitTransition } from "@/lib/use-submit-transition";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { supplierFormSchema, type SupplierFormValues } from "../schema";
import {
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type SupplierWithUsage,
} from "../actions";
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
import { AlertTriangle, Building2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

interface SuppliersTabProps {
  initialSuppliers: SupplierWithUsage[];
}

const inputClass =
  "bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]";

const emptyValues = (): SupplierFormValues => ({
  name: "",
  taxId: "",
  contactName: "",
  phone: "",
  email: "",
  isActive: true,
});

export function SuppliersTab({ initialSuppliers }: SuppliersTabProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierWithUsage | null>(null);
  const [deleting, setDeleting] = useState<SupplierWithUsage | null>(null);
  const [isPending, startTransition] = useSubmitTransition();

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: emptyValues(),
  });

  function handleOpenCreate() {
    setEditing(null);
    form.reset(emptyValues());
    setIsFormOpen(true);
  }

  function handleOpenEdit(supplier: SupplierWithUsage) {
    setEditing(supplier);
    form.reset({
      name: supplier.name,
      taxId: supplier.taxId ?? "",
      contactName: supplier.contactName ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      isActive: supplier.isActive ?? true,
    });
    setIsFormOpen(true);
  }

  function handleSubmit(values: SupplierFormValues) {
    startTransition(async () => {
      const res = editing
        ? await updateSupplier(editing.id, values)
        : await createSupplier(values);
      if (res.success) {
        toast.success(editing ? "Proveedor actualizado" : "Proveedor registrado", {
          description: res.message,
        });
        setIsFormOpen(false);
      } else {
        toast.error("Error al guardar", { description: res.error });
      }
    });
  }

  function handleDeleteConfirm() {
    if (!deleting) return;
    const supplier = deleting;
    startTransition(async () => {
      const res = await deleteSupplier(supplier.id);
      if (res.success) {
        toast.success("Proveedor eliminado", { description: `Se retiró "${supplier.name}".` });
        setDeleting(null);
      } else {
        toast.error("Error al eliminar", { description: res.error });
      }
    });
  }

  const columns = useMemo<ColumnDef<SupplierWithUsage>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Proveedor",
        cell: ({ row }) => (
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Building2 className="size-3.5 shrink-0 text-[#0066CC]" />
            {row.original.name}
          </div>
        ),
      },
      {
        accessorKey: "taxId",
        header: "RUC",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.taxId ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "contactName",
        header: "Contacto",
        cell: ({ row }) => {
          const { contactName, phone, email } = row.original;
          if (!contactName && !phone && !email) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <div className="text-xs">
              <div className="font-medium">{contactName ?? "—"}</div>
              <div className="text-muted-foreground">
                {[phone, email].filter(Boolean).join(" · ")}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "accountCount",
        header: "Cuentas",
        cell: ({ row }) => (
          <span
            className="text-xs text-muted-foreground"
            title="Usuarios del sistema vinculados a este proveedor"
          >
            {row.original.accountCount}
          </span>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Estado",
        cell: ({ row }) => {
          const active = row.original.isActive ?? true;
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-semibold">
              <span className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-zinc-400"}`} />
              {active ? "Activo" : "Inactivo"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => handleOpenEdit(row.original)}
              className="text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Editar proveedor"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setDeleting(row.original)}
              className="text-red-500 hover:bg-red-500/10 hover:text-red-700"
              title="Eliminar proveedor"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={initialSuppliers}
        searchPlaceholder="Buscar por nombre, RUC o contacto..."
        emptyState={
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Building2 className="size-8 text-muted-foreground/40" />
            Aún no hay proveedores. Registra las empresas a las que subcontratas servicios.
          </div>
        }
        extraActions={
          <Button
            onClick={handleOpenCreate}
            className="h-9 shrink-0 gap-2 bg-[#0066CC] px-4 text-xs font-semibold text-white shadow-xs hover:bg-[#0055AA]"
          >
            <Plus className="size-4" />
            Nuevo Proveedor
          </Button>
        }
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="bg-card border-border text-foreground shadow-lg sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              {editing ? (
                <Pencil className="size-4 text-[#0066CC]" />
              ) : (
                <Plus className="size-4 text-[#0066CC]" />
              )}
              {editing ? "Editar Proveedor" : "Nuevo Proveedor"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Empresa a la que se subcontratan servicios. Su acceso al sistema se crea en Usuarios,
              como una sola cuenta para toda la empresa.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Razón social</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Limpieza Total S.A.C." {...field} className={inputClass} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">RUC</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="numeric"
                          placeholder="11 dígitos"
                          {...field}
                          className={`${inputClass} font-mono`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Estado</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ? "true" : "false"}
                          onValueChange={(v) => field.onChange(v === "true")}
                        >
                          <SelectTrigger className={`w-full ${inputClass}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Activo</SelectItem>
                            <SelectItem value="false">Inactivo</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Persona de contacto</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: María Torres" {...field} className={inputClass} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Teléfono</FormLabel>
                      <FormControl>
                        <Input inputMode="tel" placeholder="Ej: 987654321" {...field} className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Correo</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="contacto@empresa.com" {...field} className={inputClass} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFormOpen(false)}
                  className="border-border text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="gap-2 bg-[#0066CC] text-xs font-semibold text-white hover:bg-[#0055AA]"
                >
                  {isPending && <Loader2 className="size-3.5 animate-spin" />}
                  {editing ? "Guardar Cambios" : "Guardar Proveedor"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="bg-card border-border text-foreground shadow-lg sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-600 dark:text-red-400">
              <AlertTriangle className="size-4" />
              Eliminar Proveedor
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Seguro que deseas eliminar a{" "}
              <strong className="text-foreground">{deleting?.name}</strong>? Esta acción no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleting(null)}
              className="border-border text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleDeleteConfirm}
              className="gap-2 bg-red-600 text-xs font-semibold text-white hover:bg-red-700"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
