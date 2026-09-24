"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { type CostCenterContact } from "@/db";
import { createContact, updateContact, deleteContact } from "../actions";
import { contactFormSchema, type ContactFormValues } from "../schema";
import { DataTable } from "@/components/ui/data-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  IconPlus,
  IconUserPlus,
  IconPencil,
  IconTrash,
  IconLoader2,
  IconUser,
  IconAlertTriangle,
  IconPhone,
  IconMail,
  IconUsers,
} from "@tabler/icons-react";
import { cn } from "cn";

interface ContactsTableProps {
  costCenterId: string;
  contacts: CostCenterContact[];
}

function roleBadgeClass(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("admin"))
    return "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20";
  if (r.includes("manten") || r.includes("tecn"))
    return "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20";
  if (r.includes("cobran") || r.includes("finan") || r.includes("contab"))
    return "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20";
  return "text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20";
}

export function ContactsTable({ costCenterId, contacts }: ContactsTableProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CostCenterContact | null>(null);
  const [deletingContact, setDeletingContact] = useState<CostCenterContact | null>(null);
  const [isPending, startTransition] = useTransition();

  const createForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { costCenterId, fullName: "", role: "", phone: "", email: "" },
  });

  const editForm = useForm<{ fullName: string; role: string; phone: string; email: string }>({
    defaultValues: { fullName: "", role: "", phone: "", email: "" },
  });

  function handleOpenCreate() {
    createForm.reset({ costCenterId, fullName: "", role: "", phone: "", email: "" });
    setIsCreateOpen(true);
  }

  function handleOpenEdit(contact: CostCenterContact) {
    setEditingContact(contact);
    editForm.reset({
      fullName: contact.fullName,
      role: contact.role || "",
      phone: contact.phone || "",
      email: contact.email || "",
    });
  }

  function handleCreateSubmit(values: ContactFormValues) {
    startTransition(async () => {
      const res = await createContact(values);
      if (res.success) {
        toast.success("Contacto registrado", { description: `${values.fullName} fue agregado.` });
        setIsCreateOpen(false);
        createForm.reset();
      } else {
        toast.error("Error al crear contacto", { description: res.error });
      }
    });
  }

  function handleEditSubmit(values: { fullName: string; role: string; phone: string; email: string }) {
    if (!editingContact) return;
    startTransition(async () => {
      const res = await updateContact(editingContact.id, values);
      if (res.success) {
        toast.success("Contacto actualizado", { description: "Los cambios se guardaron." });
        setEditingContact(null);
      } else {
        toast.error("Error al actualizar", { description: res.error });
      }
    });
  }

  function handleDeleteConfirm() {
    if (!deletingContact) return;
    startTransition(async () => {
      const res = await deleteContact(deletingContact.id);
      if (res.success) {
        toast.success("Contacto eliminado", { description: "Se retiró el contacto." });
        setDeletingContact(null);
      } else {
        toast.error("Error al eliminar", { description: res.error });
      }
    });
  }

  const columns = useMemo<ColumnDef<CostCenterContact>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: "Contacto",
        cell: ({ row }) => (
          <div className="flex items-center gap-2 text-foreground">
            <IconUser className="size-3.5 text-[#0066CC] shrink-0" />
            <span className="font-semibold">{row.getValue("fullName")}</span>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "Rol",
        cell: ({ row }) => {
          const role = row.getValue<string | null>("role") || "Administrador";
          return (
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                roleBadgeClass(role)
              )}
            >
              {role}
            </span>
          );
        },
      },
      {
        accessorKey: "phone",
        header: "Teléfono",
        cell: ({ row }) => {
          const phone = row.getValue<string | null>("phone");
          return (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <IconPhone className="size-3" />
              {phone || "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "email",
        header: "Correo",
        cell: ({ row }) => {
          const email = row.getValue<string | null>("email");
          return (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <IconMail className="size-3" />
              {email || "—"}
            </span>
          );
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
          const contact = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleOpenEdit(contact)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Editar contacto"
              >
                <IconPencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeletingContact(contact)}
                className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                title="Eliminar contacto"
              >
                <IconTrash className="size-3.5" />
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
      {contacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
          <div className="mx-auto size-12 rounded-full bg-muted flex items-center justify-center">
            <IconUsers className="size-6 text-muted-foreground/70" />
          </div>
          <p className="mt-3 text-sm font-bold text-foreground">No hay contactos en esta sede</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Registra a los administradores o encargados de esta sede para enviarles las
            notificaciones de mantenimiento y facturación.
          </p>
          <Button
            onClick={handleOpenCreate}
            className="mt-5 bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs gap-2 shadow-xs"
          >
            <IconUserPlus className="size-4" />
            Registrar Contacto
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={contacts}
          searchPlaceholder="Buscar contacto..."
          extraActions={
            <Button
              onClick={handleOpenCreate}
              className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs shrink-0"
            >
              <IconPlus className="size-4" />
              Nuevo Contacto
            </Button>
          }
        />
      )}

      {/* Modal: Crear Contacto */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <IconPlus className="size-4 text-[#0066CC]" />
              Nuevo Contacto
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Registra una persona de contacto para esta sede.
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4 pt-2">
              <FormField
                control={createForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Nombre Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Juan Pérez" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Rol</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Administrador, Conserje" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: 987654321" {...field} className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Correo</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Ej: juan@corp.com" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)} className="text-xs border-border">
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2">
                  {isPending && <IconLoader2 className="size-3.5 animate-spin" />}
                  Guardar Contacto
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Contacto */}
      <Dialog open={!!editingContact} onOpenChange={(open) => !open && setEditingContact(null)}>
        <DialogContent key={editingContact?.id ?? "none"} className="bg-card border-border sm:max-w-[425px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <IconPencil className="size-4 text-[#0066CC]" />
              Editar Contacto
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEditSubmit({
                fullName: editForm.getValues("fullName"),
                role: editForm.getValues("role"),
                phone: editForm.getValues("phone"),
                email: editForm.getValues("email"),
              });
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-2">
              <label className="text-xs font-semibold">Nombre Completo</label>
              <Input
                defaultValue={editingContact?.fullName}
                onChange={(e) => editForm.setValue("fullName", e.target.value)}
                required
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Rol</label>
              <Input
                defaultValue={editingContact?.role || ""}
                onChange={(e) => editForm.setValue("role", e.target.value)}
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold">Teléfono</label>
                <Input
                  defaultValue={editingContact?.phone || ""}
                  onChange={(e) => editForm.setValue("phone", e.target.value)}
                  className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold">Correo</label>
                <Input
                  defaultValue={editingContact?.email || ""}
                  onChange={(e) => editForm.setValue("email", e.target.value)}
                  className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingContact(null)} className="text-xs border-border">
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
      <Dialog open={!!deletingContact} onOpenChange={(open) => !open && setDeletingContact(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <IconAlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              Eliminar Contacto
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Confirmas la eliminación del contacto{" "}
              <strong className="text-foreground">{deletingContact?.fullName}</strong>?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDeletingContact(null)} className="text-xs border-border">
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