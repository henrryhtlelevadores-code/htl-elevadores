"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { type Role } from "@/db";
import { type UserListItem, createUser, updateUser, deleteUser, changeUserPassword } from "../actions";
import {
  userFormSchema,
  changeUserPasswordSchema,
  type UserFormValues,
  type ChangeUserPasswordValues,
} from "../schema";
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
  Users,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Phone,
  AlertTriangle,
  UserRound,
  ArrowUpDown,
} from "lucide-react";

interface UsersTableProps {
  initialUsers: UserListItem[];
  roles: Role[];
}

const TYPE_STYLES: Record<string, string> = {
  ADMINISTRADOR: "bg-[#0066CC]/10 text-[#0066CC] dark:text-blue-400 border-[#0066CC]/20",
  SUPERVISOR: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  "TECNICO DE CAMPO": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  SOPORTE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function UsersTable({ initialUsers, roles }: UsersTableProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserListItem | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserListItem | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [isPending, startTransition] = useTransition();

  const passwordForm = useForm<ChangeUserPasswordValues>({
    resolver: zodResolver(changeUserPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      roleId: roles[0]?.id ?? "",
      status: "ACTIVE",
      documentType: "DNI",
      documentNumber: "",
      specialization: "",
      licenseNumber: "",
      password: "",
    },
  });

  function handleOpenCreate() {
    setEditingUser(null);
    setShowPassword(false);
    form.reset({
      fullName: "",
      email: "",
      phone: "",
      roleId: roles[0]?.id ?? "",
      status: "ACTIVE",
      documentType: "DNI",
      documentNumber: "",
      specialization: "",
      licenseNumber: "",
      password: "",
    });
    setIsFormOpen(true);
  }

  function handleOpenEdit(user: UserListItem) {
    setEditingUser(user);
    setShowPassword(false);
    form.reset({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone ?? "",
      roleId: user.roleId,
      status: user.status as "ACTIVE" | "INACTIVE",
      documentType: "DNI",
      documentNumber: user.documentNumber ?? "",
      specialization: user.specialization ?? "",
      licenseNumber: "",
      password: "",
    });
    setIsFormOpen(true);
  }

  function handleSubmit(values: UserFormValues) {
    if (!editingUser && !values.password) {
      toast.error("Contraseña requerida", {
        description: "Debes asignar una contraseña al nuevo usuario.",
      });
      return;
    }
    startTransition(async () => {
      const res = editingUser
        ? await updateUser(editingUser.id, values)
        : await createUser(values);
      if (res.success) {
        toast.success(editingUser ? "Usuario actualizado" : "Usuario creado", {
          description: res.message,
        });
        setIsFormOpen(false);
        setEditingUser(null);
        form.reset();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleDeleteConfirm() {
    if (!deletingUser) return;
    startTransition(async () => {
      const res = await deleteUser(deletingUser.id);
      if (res.success) {
        toast.success("Usuario eliminado", {
          description: `Se ha retirado ${deletingUser.fullName}.`,
        });
        setDeletingUser(null);
      } else {
        toast.error("Error al eliminar", { description: res.error });
      }
    });
  }

  function handleOpenPasswordChange(user: UserListItem) {
    setPasswordUser(user);
    setShowPasswords(false);
    passwordForm.reset({ password: "", confirmPassword: "" });
  }

  function handleSubmitPasswordChange(values: ChangeUserPasswordValues) {
    if (!passwordUser) return;
    startTransition(async () => {
      const res = await changeUserPassword(passwordUser.id, values);
      if (res.success) {
        toast.success("Contraseña actualizada", {
          description: `Se cambió la contraseña de ${passwordUser.fullName}.`,
        });
        setPasswordUser(null);
      } else {
        toast.error("Error al cambiar contraseña", { description: res.error });
      }
    });
  }

  const columns = useMemo<ColumnDef<UserListItem>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-xs font-semibold hover:bg-muted/60"
          >
            Personal
            <ArrowUpDown className="ml-1.5 size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="flex items-center gap-2.5">
              <div className="size-8 shrink-0 rounded-full bg-[#0066CC]/10 text-[#0066CC] dark:text-blue-400 flex items-center justify-center text-[11px] font-bold">
                {initials(user.fullName)}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{user.fullName}</p>
                <p className="text-[10px] text-muted-foreground">{user.email}</p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "role_name",
        header: "Rol",
        cell: ({ row }) => {
          const role = row.getValue<string>("role_name") || "—";
          const style = TYPE_STYLES[role] || "";
          return (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${style}`}>
              {role}
            </span>
          );
        },
      },
      {
        accessorKey: "specialization",
        header: "Especialidad",
        cell: ({ row }) => {
          const spec = row.getValue<string | null>("specialization");
          return (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserRound className="size-3 text-[#0066CC]" />
              {spec || "—"}
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
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="size-3 text-[#0066CC]" />
              {phone || "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => {
          const status = row.getValue<string>("status");
          const active = status === "ACTIVE";
          return (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
              active
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-border bg-muted/50 text-zinc-500"
            }`}>
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
          const user = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleOpenPasswordChange(user)}
                className="text-muted-foreground hover:text-[#0066CC] hover:bg-[#0066CC]/10"
                title="Cambiar contraseña"
              >
                <KeyRound className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleOpenEdit(user)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Editar usuario"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeletingUser(user)}
                className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                title="Eliminar usuario"
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
        data={initialUsers}
        searchPlaceholder="Buscar por nombre, correo o especialidad..."
        extraActions={
          <Button
            onClick={handleOpenCreate}
            disabled={roles.length === 0}
            className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs shrink-0"
            title={roles.length === 0 ? "Primero registra roles" : undefined}
          >
            <Plus className="size-4" />
            Nuevo Usuario
          </Button>
        }
      />

      {/* Modal: Crear / Editar Usuario */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingUser(null); }}>
        <DialogContent className="bg-card border-border sm:max-w-[640px] text-foreground shadow-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Users className="size-4 text-[#0066CC]" />
              {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingUser
                ? "Actualiza los datos del colaborador. Deja la contraseña vacía para mantener la actual."
                : "Registra un colaborador con su perfil de personal y acceso al sistema."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Nombre Completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Juan Pérez Torres" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
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
                      <FormLabel className="text-xs font-semibold">Correo Electrónico *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="juan.perez@htl.com.pe" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="roleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Rol *</FormLabel>
                      <FormControl>
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue placeholder="Selecciona un rol">
                              {roles.find((r) => r.id === field.value)?.name ?? null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Estado</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue>
                              {field.value === "ACTIVE" ? "Activo" : field.value === "INACTIVE" ? "Inactivo" : null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ACTIVE">Activo</SelectItem>
                            <SelectItem value="INACTIVE">Inactivo</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: 999 888 777" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="specialization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Especialidad</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Electricista, Mecánico" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="documentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Tipo de Documento</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["DNI", "CE", "RUC", "PASSPORT"].map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
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
                  name="documentNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">N° de Documento *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: 71234567" {...field} className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="licenseNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Licencia / Colegiatura</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: CIP 123456" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                        <Lock className="size-3 text-[#0066CC]" />
                        {editingUser ? "Nueva Contraseña" : "Contraseña *"}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder={editingUser ? "Dejar vacío para no cambiar" : "Mínimo 8 caracteres"}
                            {...field}
                            className="bg-background border-border text-xs pr-9 font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                          >
                            {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { setIsFormOpen(false); setEditingUser(null); }} className="text-xs border-border">
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2">
                  {isPending && <Loader2 className="size-3.5 animate-spin" />}
                  {editingUser ? "Guardar Cambios" : "Crear Usuario"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Cambiar Contraseña */}
      <Dialog open={!!passwordUser} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[420px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <KeyRound className="size-4 text-[#0066CC]" />
              Cambiar Contraseña
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Establece una nueva contraseña para{" "}
              <strong className="text-foreground">{passwordUser?.fullName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit(handleSubmitPasswordChange)}
              className="space-y-4 pt-2"
            >
              <div className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                        <Lock className="size-3 text-[#0066CC]" />
                        Nueva Contraseña *
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPasswords ? "text" : "password"}
                            placeholder="Mínimo 8 caracteres"
                            autoComplete="new-password"
                            {...field}
                            className="bg-background border-border text-xs pr-9 font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(!showPasswords)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            title={showPasswords ? "Ocultar contraseña" : "Mostrar contraseña"}
                          >
                            {showPasswords ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold flex items-center gap-1.5">
                        <Lock className="size-3 text-[#0066CC]" />
                        Confirmar Contraseña *
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPasswords ? "text" : "password"}
                            placeholder="Repite la contraseña"
                            autoComplete="new-password"
                            {...field}
                            className="bg-background border-border text-xs pr-9 font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords(!showPasswords)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            title={showPasswords ? "Ocultar contraseña" : "Mostrar contraseña"}
                          >
                            {showPasswords ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                          </button>
                        </div>
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
                  onClick={() => setPasswordUser(null)}
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
                  Actualizar Contraseña
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Eliminación */}
      <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              Eliminar Usuario
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Estás seguro de que deseas desactivar a{" "}
              <strong className="text-foreground">{deletingUser?.fullName}</strong>? Se marcará como
              inactivo y dejará de aparecer en el sistema.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDeletingUser(null)} className="text-xs border-border">
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