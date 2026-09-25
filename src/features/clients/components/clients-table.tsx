"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { type Ubigeo } from "@/db";
import { type ClientWithStats, createClient, updateClient, deleteClient } from "../actions";
import { clientFormSchema, type ClientFormValues } from "../schema";
import { UbigeoSelector } from "./ubigeo-selector";
import { DataTable } from "@/components/ui/data-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "cn";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Building2,
  AlertTriangle,
  ArrowUpDown,
  Eye,
  MapPin,
  FileCheck2,
  Check,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

const CREATE_STEPS = [
  { title: "Datos del Cliente" },
  { title: "Sede por Defecto" },
];

const EMPTY_CLIENT_VALUES: ClientFormValues = {
  legalName: "",
  taxId: "",
  taxIdType: "RUC",
  isProcessingRuc: false,
  billingAddress: "",
  billingEmail: "",
  createDefaultHeadquarters: false,
  headquartersAddress: "",
  headquartersUbigeoId: "",
};

interface ClientsTableProps {
  clients: ClientWithStats[];
  ubigeos: Ubigeo[];
  onSelectClient: (client: ClientWithStats) => void;
}

export function ClientsTable({ clients, ubigeos, onSelectClient }: ClientsTableProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [editingClient, setEditingClient] = useState<ClientWithStats | null>(null);
  const [deletingClient, setDeletingClient] = useState<ClientWithStats | null>(null);
  const [isPending, startTransition] = useTransition();

  const createForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema) as unknown as Resolver<ClientFormValues>,
    defaultValues: EMPTY_CLIENT_VALUES,
  });

  const editForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema) as unknown as Resolver<ClientFormValues>,
    defaultValues: { ...EMPTY_CLIENT_VALUES, createDefaultHeadquarters: false },
  });

  function handleOpenCreate() {
    createForm.reset(EMPTY_CLIENT_VALUES);
    createForm.clearErrors();
    setCreateStep(0);
    setIsCreateOpen(true);
  }

  function handleOpenEdit(client: ClientWithStats) {
    setEditingClient(client);
    editForm.reset({
      legalName: client.legalName,
      taxId: client.taxId || "",
      taxIdType: (client.taxIdType as ClientFormValues["taxIdType"]) || "RUC",
      billingAddress: client.billingAddress || "",
      billingEmail: client.billingEmail || "",
      isProcessingRuc: false,
      createDefaultHeadquarters: false,
      headquartersAddress: "",
      headquartersUbigeoId: "",
    });
  }

  const wantsHeadquarters = createForm.watch("createDefaultHeadquarters");
  const visibleSteps = wantsHeadquarters ? CREATE_STEPS : CREATE_STEPS.slice(0, 1);

  async function handleCreateNext() {
    const ok = await createForm.trigger([
      "legalName",
      "taxIdType",
      "taxId",
      "billingAddress",
      "billingEmail",
    ]);
    if (ok) setCreateStep((s) => Math.min(s + 1, visibleSteps.length - 1));
  }

  function handleCreateBack() {
    setCreateStep((s) => Math.max(s - 1, 0));
  }

  function handleToggleHeadquarters(checked: boolean) {
    createForm.setValue("createDefaultHeadquarters", checked, { shouldValidate: true });
    if (!checked) {
      setCreateStep(0);
      createForm.clearErrors("headquartersAddress");
    }
  }

  function handleCreateSubmit(values: ClientFormValues) {
    if (createStep < visibleSteps.length - 1) {
      handleCreateNext();
      return;
    }
    startTransition(async () => {
      const res = await createClient(values);
      if (res.success) {
        toast.success("Cliente registrado", {
          description: res.createdHeadquarters
            ? `El cliente "${values.legalName}" se guardó junto con su sede principal.`
            : `El cliente "${values.legalName}" se guardó correctamente.`,
        });
        setIsCreateOpen(false);
        setCreateStep(0);
        createForm.reset(EMPTY_CLIENT_VALUES);
      } else {
        toast.error("Error al registrar cliente", { description: res.error });
      }
    });
  }

  function handleEditSubmit(values: ClientFormValues) {
    if (!editingClient) return;
    startTransition(async () => {
      const res = await updateClient(editingClient.id, values);
      if (res.success) {
        toast.success("Cliente actualizado", {
          description: `Se actualizaron los datos de "${values.legalName}".`,
        });
        setEditingClient(null);
      } else {
        toast.error("Error al actualizar", { description: res.error });
      }
    });
  }

  function handleDeleteConfirm() {
    if (!deletingClient) return;
    startTransition(async () => {
      const res = await deleteClient(deletingClient.id);
      if (res.success) {
        toast.success("Cliente eliminado", {
          description: `Se eliminó el cliente "${deletingClient.legalName}".`,
        });
        setDeletingClient(null);
      } else {
        toast.error("Error al eliminar", { description: res.error });
      }
    });
  }

  const columns = useMemo<ColumnDef<ClientWithStats>[]>(
    () => [
      {
        accessorKey: "legalName",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-xs font-semibold hover:bg-muted/60"
          >
            Razón Social
            <ArrowUpDown className="ml-1.5 size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-start gap-2 font-medium text-foreground">
            <Building2 className="size-3.5 text-[#0066CC] shrink-0 mt-0.5" />
            <span className="font-semibold leading-snug min-w-0 max-w-[200px] whitespace-normal break-words">
              {row.getValue("legalName")}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "taxId",
        header: "RUC",
        cell: ({ row }) => {
          const taxId = row.getValue<string>("taxId");
          return (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <FileCheck2 className="size-3 text-muted-foreground" />
              <span>{taxId}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "billingEmail",
        header: "Correo",
        cell: ({ row }) => {
          const email = row.getValue<string | null>("billingEmail");
          return <span className="text-xs text-muted-foreground">{email || "—"}</span>;
        },
      },
      {
        accessorKey: "cost_centers_count",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-xs font-semibold hover:bg-muted/60"
          >
            Sedes / Centros
            <ArrowUpDown className="ml-1.5 size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => {
          const count = row.getValue("cost_centers_count") as number;
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#0066CC]/10 text-[#0066CC] dark:text-blue-400 border border-[#0066CC]/20">
              <MapPin className="size-3" />
              {count} {count === 1 ? "sede" : "sedes"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                variant="outline"
                size="xs"
                onClick={() => onSelectClient(item)}
                className="h-7 px-2.5 text-xs font-semibold text-[#0066CC] dark:text-blue-400 border-[#0066CC]/30 hover:bg-[#0066CC]/10 gap-1.5 shadow-2xs"
              >
                <Eye className="size-3" />
                Ver Detalle
              </Button>

              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleOpenEdit(item)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Editar cliente"
              >
                <Pencil className="size-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeletingClient(item)}
                className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                title="Eliminar cliente"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [onSelectClient]
  );

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={clients}
        searchPlaceholder="Buscar por nombre, RUC o correo..."
        extraActions={
          <Button
            onClick={handleOpenCreate}
            className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs shrink-0"
          >
            <Plus className="size-4" />
            Nuevo Cliente
          </Button>
        }
      />

      {/* Modal: Crear Cliente */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px] text-foreground shadow-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="size-4 text-[#0066CC]" />
              Nuevo Cliente
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Registra los datos comerciales del cliente o empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {visibleSteps.map((s, i) => {
              const done = createStep > i;
              const active = createStep === i;
              return (
                <div key={s.title} className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <div
                      className={cn(
                        "size-6 rounded-full border flex items-center justify-center shrink-0",
                        active
                          ? "bg-[#0066CC] border-[#0066CC] text-white"
                          : done
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "bg-muted/60 border-border text-muted-foreground"
                      )}
                    >
                      {done ? <Check className="size-3.5" /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-semibold whitespace-nowrap",
                        active ? "text-foreground" : done ? "text-foreground/70" : "text-muted-foreground"
                      )}
                    >
                      {s.title}
                    </span>
                  </div>
                  {i < visibleSteps.length - 1 && <div className="h-px w-6 bg-border mx-1 shrink-0" />}
                </div>
              );
            })}
          </div>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4 pt-1">
              {createStep === 0 && (
                <>
                  <FormField
                    control={createForm.control}
                    name="legalName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Razón Social/Nombre Comercial</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={2}
                            placeholder="Ej: Corporación Real S.A."
                            {...field}
                            className="resize-none bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="taxIdType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Tipo de Documento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                              <SelectValue placeholder="Selecciona el tipo de documento" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="RUC">RUC</SelectItem>
                            <SelectItem value="DNI">DNI</SelectItem>
                            <SelectItem value="CE">Carnet de Extranjería</SelectItem>
                            <SelectItem value="SIN_DOC">Sin Documento</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {createForm.watch("taxIdType") !== "SIN_DOC" && (
                    <FormField
                      control={createForm.control}
                      name="taxId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Número del Documento</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={
                                createForm.watch("taxIdType") === "DNI"
                                  ? "Ej: 12345678"
                                  : createForm.watch("taxIdType") === "CE"
                                    ? "Ej: 001234567"
                                    : "Ej: 20100047218"
                              }
                              {...field}
                              className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={createForm.control}
                    name="billingAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Dirección Fiscal</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={2}
                            placeholder="Ej: Av. Larco 1234, Miraflores"
                            {...field}
                            className="resize-none bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="isProcessingRuc"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0 rounded-md border border-border p-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-xs font-semibold">
                          Documento en trámite (está procesando su RUC)
                        </FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="billingEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Correo de Facturación</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="Ej: facturacion@empresa.com"
                            {...field}
                            className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="createDefaultHeadquarters"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0 rounded-md border border-border p-3">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => handleToggleHeadquarters(checked === true)}
                          />
                        </FormControl>
                        <FormLabel className="text-xs font-semibold">
                          Crear sede por defecto
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </>
              )}

              {createStep === 1 && (
                <>
                  <FormField
                    control={createForm.control}
                    name="headquartersAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Dirección de la Sede</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={2}
                            placeholder="Ej: Av. Larco 1234, Miraflores"
                            {...field}
                            className="resize-none bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="headquartersUbigeoId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">
                          Ubicación (Departamento / Provincia / Distrito)
                        </FormLabel>
                        <FormControl>
                          <UbigeoSelector
                            ubigeos={ubigeos}
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

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
                {createStep > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCreateBack}
                    className="text-xs border-border gap-1"
                  >
                    <ChevronLeft className="size-3.5" />
                    Volver
                  </Button>
                )}
                {createStep < visibleSteps.length - 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateNext}
                    className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-1"
                  >
                    Siguiente
                    <ChevronRight className="size-3.5" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isPending}
                    className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
                  >
                    {isPending && <Loader2 className="size-3.5 animate-spin" />}
                    Guardar Cliente
                  </Button>
                )}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Cliente */}
      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[425px] text-foreground shadow-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="size-4 text-[#0066CC]" />
              Editar Cliente
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Actualiza los datos comerciales de {editingClient?.legalName}.
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4 pt-1">
              <FormField
                control={editForm.control}
                name="legalName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Razón Social/Nombre Comercial</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Ej: Corporación Real S.A."
                        {...field}
                        className="resize-none bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="taxIdType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Tipo de Documento</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                          <SelectValue placeholder="Selecciona el tipo de documento" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="RUC">RUC</SelectItem>
                        <SelectItem value="DNI">DNI</SelectItem>
                        <SelectItem value="CE">Carnet de Extranjería</SelectItem>
                        <SelectItem value="SIN_DOC">Sin Documento</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {editForm.watch("taxIdType") !== "SIN_DOC" && (
                <FormField
                  control={editForm.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Número del Documento</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            editForm.watch("taxIdType") === "DNI"
                              ? "Ej: 12345678"
                              : editForm.watch("taxIdType") === "CE"
                                ? "Ej: 001234567"
                                : "Ej: 20100047218"
                          }
                          {...field}
                          className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={editForm.control}
                name="billingAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Dirección Fiscal</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Ej: Av. Larco 1234, Miraflores"
                        {...field}
                        className="resize-none bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="isProcessingRuc"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0 rounded-md border border-border p-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-xs font-semibold">
                      Documento en trámite (está procesando su RUC)
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="billingEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Correo de Facturación</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Ej: facturacion@empresa.com"
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
                  onClick={() => setEditingClient(null)}
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
      <Dialog open={!!deletingClient} onOpenChange={(open) => !open && setDeletingClient(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              Eliminar Cliente
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Confirmas la eliminación de{" "}
              <strong className="text-foreground">{deletingClient?.legalName}</strong>?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingClient(null)}
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