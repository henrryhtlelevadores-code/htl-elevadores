"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ElevatorUnityWithRelations, type EquipmentFormData, createEquipment, updateEquipment, toggleEquipmentStatus, deleteEquipment } from "../actions";
import { elevatorUnityFormSchema, type ElevatorUnityFormValues } from "../schema";
import { DataTable } from "@/components/ui/data-table";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

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
  Cpu,
  AlertTriangle,
  ArrowUpDown,
  MapPin,
  Building2,
  X,
  Search,
  Lock,
  Info,
} from "lucide-react";
import type { ReactNode } from "react";

interface EquipmentTableProps {
  initialEquipment: ElevatorUnityWithRelations[];
  formData: EquipmentFormData;
}

const STATUS_STYLES: Record<string, string> = {
  OPERATIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  MAINTENANCE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  OUT_OF_SERVICE: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  OPERATIVE: "Operativo",
  MAINTENANCE: "En Mantenimiento",
  OUT_OF_SERVICE: "Fuera de Servicio",
};

function SectionHeading({
  title,
  icon,
  locked,
}: {
  title: string;
  icon: ReactNode;
  locked?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 pt-1 border-b border-border/70 pb-2">
      {icon}
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-foreground/80">{title}</h3>
      {locked && (
        <Tooltip>
          <TooltipTrigger className="inline-flex text-[#0066CC] cursor-help">
            <Lock className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent side="bottom">Ubicación pre-seleccionada según el filtro actual</TooltipContent>
        </Tooltip>
      )}
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function EmptyState({
  hasFilters,
  onCreate,
  onClear,
}: {
  hasFilters: boolean;
  onCreate: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-[#0066CC]/10 border border-[#0066CC]/15 shadow-xs">
        <Cpu className="size-8 text-[#0066CC]" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">No se encontraron equipos</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          {hasFilters
            ? "Ningún equipo coincide con los filtros aplicados. Ajusta la búsqueda para continuar."
            : "Aún no hay unidades registradas. Comienza registrando el primer equipo de elevación con sus especificaciones técnicas."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {hasFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
            className="text-xs border-border font-semibold"
          >
            Limpiar filtros
          </Button>
        )}
        <Button
          size="sm"
          onClick={onCreate}
          className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs gap-2 shadow-xs"
        >
          <Plus className="size-4" />
          Registrar Primer Equipo
        </Button>
      </div>
    </div>
  );
}

export function EquipmentTable({ initialEquipment, formData }: EquipmentTableProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<ElevatorUnityWithRelations | null>(null);
  const [deletingEquipment, setDeletingEquipment] = useState<ElevatorUnityWithRelations | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [contextLocked, setContextLocked] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClientId, setFilterClientId] = useState(searchParams.get("cliente_id") ?? "");
  const [filterCostCenterId, setFilterCostCenterId] = useState(
    searchParams.get("centro_costo_id") ?? ""
  );
  const [isPending, startTransition] = useTransition();

  const costCenterOptions = useMemo(
    () =>
      filterClientId
        ? formData.costCenters.filter((cc) => cc.clientId === filterClientId)
        : formData.costCenters,
    [filterClientId, formData.costCenters]
  );

  const filteredEquipment = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return initialEquipment.filter((e) => {
      if (filterCostCenterId && e.costCenterId !== filterCostCenterId) return false;
      if (filterClientId) {
        const cc = formData.costCenters.find((c) => c.id === e.costCenterId);
        if (!cc || cc.clientId !== filterClientId) return false;
      }
      if (!q) return true;
      return (
        (e.internalCode || "").toLowerCase().includes(q) ||
        (e.name || "").toLowerCase().includes(q) ||
        (e.client_name || "").toLowerCase().includes(q) ||
        (e.cost_center_name || "").toLowerCase().includes(q) ||
        (e.brand_name || "").toLowerCase().includes(q) ||
        (e.elevator_type_name || "").toLowerCase().includes(q)
      );
    });
  }, [initialEquipment, filterClientId, filterCostCenterId, searchQuery, formData.costCenters]);

  const hasFilters = Boolean(searchQuery || filterClientId || filterCostCenterId);

  function updateUrl(clientId: string, costCenterId: string) {
    const params = new URLSearchParams();
    if (clientId) params.set("cliente_id", clientId);
    if (costCenterId) params.set("centro_costo_id", costCenterId);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleClientFilterChange(value: string | null) {
    const next = value === "all" ? "" : value ?? "";
    const cc = formData.costCenters.find((c) => c.id === filterCostCenterId);
    const nextCc = next && filterCostCenterId && cc && cc.clientId !== next ? "" : filterCostCenterId;
    setFilterClientId(next);
    if (nextCc !== filterCostCenterId) setFilterCostCenterId(nextCc);
    updateUrl(next, nextCc);
  }

  function handleCostCenterFilterChange(value: string | null) {
    const next = value === "all" ? "" : value ?? "";
    setFilterCostCenterId(next);
    updateUrl(filterClientId, next);
  }

  const selectedCostCenterName = filterCostCenterId
    ? formData.costCenters.find((c) => c.id === filterCostCenterId)?.name ?? null
    : null;

  const defaultValues = {
    costCenterId: "",
    brandId: "",
    modelId: "",
    elevatorTypeId: "",
    internalCode: "",
    manufacturerSerial: "",
    name: "",
    capacityPersons: undefined,
    capacityKg: undefined,
    speedMs: undefined,
    stops: undefined,
    floors: undefined,
    tractionType: "",
    yearOfFabrication: undefined,
    status: "OPERATIVE",
  };

  const createForm = useForm<ElevatorUnityFormValues>({
    resolver: zodResolver(elevatorUnityFormSchema),
    defaultValues: defaultValues as never,
  });

  const selectedBrandId = useWatch({ control: createForm.control, name: "brandId" });

  function handleOpenCreate() {
    const nextCode = `HTL-${String(initialEquipment.length + 1).padStart(2, "0")}`;
    if (filterCostCenterId) {
      const cc = formData.costCenters.find((c) => c.id === filterCostCenterId);
      setSelectedClientId(cc?.clientId ?? "");
      setContextLocked(true);
      createForm.reset({
        ...defaultValues,
        internalCode: nextCode,
        costCenterId: filterCostCenterId,
      } as never);
    } else {
      setSelectedClientId("");
      setContextLocked(false);
      createForm.reset({ ...defaultValues, internalCode: nextCode } as never);
    }
    setIsCreateOpen(true);
  }

  function handleOpenEdit(equipment: ElevatorUnityWithRelations) {
    const cc = formData.costCenters.find((c) => c.id === equipment.costCenterId);
    setSelectedClientId(cc?.clientId ?? "");
    setContextLocked(false);
    setEditingEquipment(equipment);
    createForm.reset({
      costCenterId: equipment.costCenterId,
      brandId: equipment.brandId || "",
      modelId: equipment.modelId || "",
      elevatorTypeId: equipment.elevatorTypeId,
      internalCode: equipment.internalCode,
      manufacturerSerial: equipment.manufacturerSerial || "",
      name: equipment.name,
      capacityPersons: equipment.capacityPersons ?? undefined,
      capacityKg: equipment.capacityKg ?? undefined,
      speedMs: equipment.speedMs ?? undefined,
      stops: equipment.stops ?? undefined,
      floors: equipment.floors ?? undefined,
      tractionType: equipment.tractionType || "",
      yearOfFabrication: equipment.yearOfFabrication ?? undefined,
      status: equipment.status || "OPERATIVE",
    } as never);
    setIsCreateOpen(true);
  }

  function handleCreateSubmit(values: ElevatorUnityFormValues) {
    startTransition(async () => {
      const res = editingEquipment
        ? await updateEquipment(editingEquipment.id, values)
        : await createEquipment(values);
      if (res.success) {
        if (editingEquipment) {
          toast.success("Equipo actualizado", { description: res.message });
        } else {
          const ccName =
            formData.costCenters.find((c) => c.id === values.costCenterId)?.name ?? "la sede";
          toast.success("Equipo creado con éxito", {
            description: `Equipo ${values.internalCode} creado con éxito en ${ccName}.`,
          });
        }
        setIsCreateOpen(false);
        setEditingEquipment(null);
        createForm.reset();
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleStatusToggle(equipment: ElevatorUnityWithRelations, status: string) {
    startTransition(async () => {
      const res = await toggleEquipmentStatus(equipment.id, status);
      if (res.success) {
        toast.success("Estado actualizado", { description: `Equipo ${STATUS_LABELS[status]}.` });
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleDeleteConfirm() {
    if (!deletingEquipment) return;
    startTransition(async () => {
      const res = await deleteEquipment(deletingEquipment.id);
      if (res.success) {
        toast.success("Equipo eliminado", {
          description: `Se eliminó "${deletingEquipment.internalCode}".`,
        });
        setDeletingEquipment(null);
        router.refresh();
      } else {
        toast.error("Error al eliminar", { description: res.error });
      }
    });
  }

  function handleClearFilters() {
    setSearchQuery("");
    setFilterClientId("");
    setFilterCostCenterId("");
    updateUrl("", "");
  }

  const columns = useMemo<ColumnDef<ElevatorUnityWithRelations>[]>(
    () => [
      {
        accessorKey: "internalCode",
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
            {row.getValue("internalCode")}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Equipo",
        cell: ({ row }) => (
          <div className="flex items-center gap-2 text-foreground">
            <Cpu className="size-3.5 text-[#0066CC] shrink-0" />
            <span className="font-semibold">{row.getValue<string>("name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "elevator_type_name",
        header: "Tipo",
        cell: ({ row }) => {
          const type = row.getValue<string | null>("elevator_type_name");
          return <span className="text-xs text-muted-foreground">{type || "—"}</span>;
        },
      },
      {
        accessorKey: "brand_name",
        header: "Marca",
        cell: ({ row }) => {
          const brand = row.getValue<string | null>("brand_name");
          return brand ? (
            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border border-[#0066CC]/20 bg-[#0066CC]/5 text-[#0066CC] dark:text-blue-400">
              {brand}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        },
      },
      {
        accessorKey: "cost_center_name",
        header: "Centro de Costo",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground max-w-[200px]">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{row.getValue("cost_center_name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "client_name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-xs font-semibold hover:bg-muted/60"
          >
            Cliente
            <ArrowUpDown className="ml-1.5 size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground max-w-[180px]">
            <Building2 className="size-3 shrink-0" />
            <span className="truncate">{row.getValue("client_name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "capacityKg",
        header: "Capacidad",
        cell: ({ row }) => {
          const kg = row.getValue<number | null>("capacityKg");
          return <span className="text-xs font-mono text-muted-foreground">{kg ? `${kg} kg` : "—"}</span>;
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => {
          const status = row.getValue<string | null>("status") ?? "OPERATIVE";
          const style = STATUS_STYLES[status] || STATUS_STYLES.OPERATIVE;
          return (
            <Select value={status} onValueChange={(v) => v && handleStatusToggle(row.original, v)}>
              <SelectTrigger size="sm" className={`w-fit h-6 px-2 text-[10px] font-semibold rounded-full border ${style}`}>
                <SelectValue>{STATUS_LABELS[status] ?? null}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => {
          const equipment = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleOpenEdit(equipment)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Editar equipo"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeletingEquipment(equipment)}
                className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                title="Eliminar equipo"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="flex flex-col lg:flex-row items-stretch gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código, nombre o cliente..."
            className="pl-9 pr-8 bg-background border-border text-xs h-8 focus-visible:ring-1 focus-visible:ring-[#0066CC]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <Select
          value={filterClientId || "all"}
          onValueChange={handleClientFilterChange}
        >
          <SelectTrigger className="w-full lg:w-[240px] bg-background border-border text-xs h-8 focus-visible:ring-1 focus-visible:ring-[#0066CC]">
            <SelectValue>
              {filterClientId
                ? formData.clients.find((c) => c.id === filterClientId)?.legalName ?? null
                : "Todos los clientes"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent searchable>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {formData.clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.legalName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterCostCenterId || "all"}
          onValueChange={handleCostCenterFilterChange}
        >
          <SelectTrigger className="w-full lg:w-[260px] bg-background border-border text-xs h-8 focus-visible:ring-1 focus-visible:ring-[#0066CC]">
            <SelectValue>
              {selectedCostCenterName
                ? `${selectedCostCenterName}${filterClientId ? "" : ""}`
                : "Todos los centros de costo"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent searchable>
            <SelectItem value="all">Todos los centros de costo</SelectItem>
            {costCenterOptions.map((cc) => (
              <SelectItem key={cc.id} value={cc.id}>
                {cc.name} — {cc.client_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleOpenCreate}
          className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-8 px-4 gap-2 shadow-xs shrink-0 lg:self-center"
        >
          <Plus className="size-4" />
          Nuevo Equipo
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredEquipment}
        hideSearch
        emptyState={
          <EmptyState
            hasFilters={hasFilters}
            onCreate={handleOpenCreate}
            onClear={handleClearFilters}
          />
        }
      />

      {/* Modal: Crear/Editar Equipo */}
      <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (!o) setEditingEquipment(null); }}>
        <DialogContent className="bg-card border-border sm:max-w-[640px] text-foreground shadow-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {editingEquipment ? (
                <Pencil className="size-4 text-[#0066CC]" />
              ) : (
                <Plus className="size-4 text-[#0066CC]" />
              )}
              {editingEquipment ? `Editar Equipo: ${editingEquipment.internalCode}` : "Nuevo Equipo de Elevación"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Registra una unidad de transporte vertical con sus especificaciones técnicas.
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4 pt-2">
              {/* Sección 1: Ubicación e Identificación */}
              <section className="space-y-3">
                <SectionHeading title="Ubicación e Identificación" icon={<MapPin className="size-3.5 text-[#0066CC]" />} locked={contextLocked} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={createForm.control}
                    name="internalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Código Interno</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: HTL-01"
                            readOnly={!editingEquipment}
                            title={editingEquipment ? undefined : "Se genera automáticamente"}
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
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Nombre del Equipo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ascensor Principal - Torre A" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={createForm.control}
                    name="costCenterId"
                    render={() => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Cliente</FormLabel>
                        <FormControl>
                          <Select
                            value={selectedClientId}
                            onValueChange={(v) => {
                              setSelectedClientId(v ?? "");
                              createForm.setValue("costCenterId", "");
                            }}
                            disabled={contextLocked}
                          >
                            <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC] disabled:cursor-not-allowed">
                              <SelectValue placeholder="Selecciona el cliente">
                                {formData.clients.find((c) => c.id === selectedClientId)?.legalName ?? null}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent searchable>
                              {formData.clients.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.legalName}
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
                    control={createForm.control}
                    name="costCenterId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Centro de Costo</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={!selectedClientId || contextLocked}
                          >
                            <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC] disabled:cursor-not-allowed">
                              <SelectValue placeholder={selectedClientId ? "Selecciona el centro de costo" : "Primero elige el cliente"}>
                                {(() => {
                                  const cc = formData.costCenters.find((c) => c.id === field.value);
                                  return cc ? `${cc.name} — ${cc.client_name}` : null;
                                })()}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent searchable>
                              {formData.costCenters
                                .filter((cc) => cc.clientId === selectedClientId)
                                .map((cc) => (
                                  <SelectItem key={cc.id} value={cc.id}>
                                    {cc.name}
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
              </section>

              {/* Sección 2: Especificaciones Técnicas */}
              <section className="space-y-3">
                <SectionHeading title="Especificaciones Técnicas" icon={<Cpu className="size-3.5 text-[#0066CC]" />} />
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={createForm.control}
                    name="elevatorTypeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Tipo</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                              <SelectValue placeholder="Tipo">
                                {formData.elevatorTypes.find((t) => t.id === field.value)?.name ?? null}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {formData.elevatorTypes.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
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
                    control={createForm.control}
                    name="brandId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Marca</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value || ""}
                            onValueChange={(v) => {
                              field.onChange(v ?? "");
                              const currentModel = createForm.getValues("modelId");
                              if (
                                currentModel &&
                                !formData.models.some(
                                  (m) => m.id === currentModel && m.brandId === v
                                )
                              ) {
                                createForm.setValue("modelId", "");
                              }
                            }}
                          >
                            <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                              <SelectValue placeholder="Marca">
                                {formData.brands.find((b) => b.id === field.value)?.name ?? null}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent searchable>
                              {formData.brands.map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.name}
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
                    control={createForm.control}
                    name="modelId"
                    render={({ field }) => {
                      const filteredModels = formData.models.filter((m) => m.brandId === selectedBrandId);
                      return (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Modelo</FormLabel>
                          <FormControl>
                            <Select value={field.value || ""} onValueChange={(v) => field.onChange(v ?? "")}>
                              <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                                <SelectValue placeholder="Modelo">
                                  {formData.models.find((m) => m.id === field.value)?.name ??
                                    (field.value === "" || field.value === undefined ? "Sin modelo" : null)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent searchable>
                                <SelectItem value="">Sin modelo</SelectItem>
                                {filteredModels.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={createForm.control}
                    name="capacityKg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Capacidad</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input type="number" placeholder="Ej: 630" {...field} value={field.value ?? ""} className="bg-background border-border pr-12 text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                          </FormControl>
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">
                            kg
                          </span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="capacityPersons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Personas</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Ej: 8" {...field} value={field.value ?? ""} className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="speedMs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Velocidad</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input type="number" step="0.1" placeholder="Ej: 1.6" {...field} value={field.value ?? ""} className="bg-background border-border pr-12 text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                          </FormControl>
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground">
                            m/s
                          </span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={createForm.control}
                    name="stops"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-1">
                          <FormLabel className="text-xs font-semibold">Paradas</FormLabel>
                          <Tooltip>
                            <TooltipTrigger className="inline-flex text-muted-foreground cursor-help">
                              <Info className="size-3" />
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              Nivel de cada detención del ascensor (ej. 10 paradas = 10 niveles atendidos).
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <FormControl>
                          <Input type="number" placeholder="Ej: 10" {...field} value={field.value ?? ""} className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="floors"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-1">
                          <FormLabel className="text-xs font-semibold">Pisos</FormLabel>
                          <Tooltip>
                            <TooltipTrigger className="inline-flex text-muted-foreground cursor-help">
                              <Info className="size-3" />
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              Número total de pisos que recorre el ascensor en el edificio (ej. 12 pisos).
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <FormControl>
                          <Input type="number" placeholder="Ej: 12" {...field} value={field.value ?? ""} className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="yearOfFabrication"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Año Fabricación</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Ej: 2018" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              {/* Sección 3: Datos de Fábrica y Estado */}
              <section className="space-y-3">
                <SectionHeading title="Datos de Fábrica y Estado" icon={<Building2 className="size-3.5 text-[#0066CC]" />} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={createForm.control}
                    name="manufacturerSerial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Serie de Fábrica</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: SN-2024-0123" {...field} className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="tractionType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Tipo de Tracción</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Sin cuarto de máquinas" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={createForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Estado</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue>
                              {STATUS_LABELS[field.value || "OPERATIVE"] ?? null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              <DialogFooter className="pt-2 gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setIsCreateOpen(false); setEditingEquipment(null); }}
                  className="text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2 shadow-xs"
                >
                  {isPending && <Loader2 className="size-3.5 animate-spin" />}
                  {editingEquipment ? "Guardar Cambios" : "Registrar Equipo"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Eliminación */}
      <Dialog open={!!deletingEquipment} onOpenChange={(open) => !open && setDeletingEquipment(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              Eliminar Equipo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Estás seguro de eliminar el equipo{" "}
              <strong className="text-foreground">{deletingEquipment?.internalCode}</strong> —
              {deletingEquipment?.name}?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeletingEquipment(null)}
              className="text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleDeleteConfirm}
              className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold gap-2 shadow-xs"
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