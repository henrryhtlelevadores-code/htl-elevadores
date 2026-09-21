"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { type ElevatorUnityWithRelations, type EquipmentFormData, createEquipment, updateEquipment, toggleEquipmentStatus, deleteEquipment } from "../actions";
import { elevatorUnityFormSchema, type ElevatorUnityFormValues } from "../schema";
import { DataTable } from "@/components/ui/data-table";
import { CostCenterTree } from "./cost-center-tree";

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
} from "lucide-react";

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

export function EquipmentTable({ initialEquipment, formData }: EquipmentTableProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<ElevatorUnityWithRelations | null>(null);
  const [deletingEquipment, setDeletingEquipment] = useState<ElevatorUnityWithRelations | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredEquipment = useMemo(
    () =>
      selectedCostCenterId
        ? initialEquipment.filter((e) => e.costCenterId === selectedCostCenterId)
        : initialEquipment,
    [initialEquipment, selectedCostCenterId]
  );

  const selectedCostCenter = selectedCostCenterId
    ? formData.costCenters.find((c) => c.id === selectedCostCenterId) ?? null
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

  function handleOpenCreate() {
    const nextCode = `HTL-${String(initialEquipment.length + 1).padStart(2, "0")}`;
    createForm.reset({ ...defaultValues, internalCode: nextCode } as never);
    setSelectedClientId("");
    setIsCreateOpen(true);
  }

  function handleOpenEdit(equipment: ElevatorUnityWithRelations) {
    const cc = formData.costCenters.find((c) => c.id === equipment.costCenterId);
    setSelectedClientId(cc?.clientId ?? "");
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
        toast.success(editingEquipment ? "Equipo actualizado" : "Equipo registrado", {
          description: res.message,
        });
        setIsCreateOpen(false);
        setEditingEquipment(null);
        createForm.reset();
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
      } else {
        toast.error("Error al eliminar", { description: res.error });
      }
    });
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
        accessorKey: "stops",
        header: "Paradas",
        cell: ({ row }) => {
          const stops = row.getValue<number | null>("stops");
          return <span className="text-xs font-mono text-muted-foreground">{stops ?? "—"}</span>;
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
    []
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="self-start lg:sticky lg:top-20">
          <CostCenterTree
            costCenters={formData.costCenters}
            equipment={initialEquipment}
            selectedCostCenterId={selectedCostCenterId}
            onSelectCostCenter={setSelectedCostCenterId}
          />
        </div>

        <div className="space-y-4 min-w-0">
          {selectedCostCenter && (
            <div className="flex items-center justify-between rounded-lg border border-[#0066CC]/20 bg-[#0066CC]/5 px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0066CC] dark:text-blue-400">
                <MapPin className="size-3.5" />
                {selectedCostCenter.name}
                <span className="font-normal text-[10px] text-muted-foreground">
                  {filteredEquipment.length} equipo(s)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCostCenterId(null)}
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-transparent"
              >
                <X className="size-3.5" />
                Limpiar
              </Button>
            </div>
          )}

          <DataTable
            columns={columns}
            data={filteredEquipment}
            searchPlaceholder="Buscar por código, nombre o cliente..."
            extraActions={
              <Button
                onClick={handleOpenCreate}
                className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs shrink-0"
              >
                <Plus className="size-4" />
                Nuevo Equipo
              </Button>
            }
          />
        </div>
      </div>

      {/* Modal: Crear/Editar Equipo */}
      <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (!o) setEditingEquipment(null); }}>
        <DialogContent className="bg-card border-border sm:max-w-[560px] text-foreground shadow-lg max-h-[90vh] overflow-y-auto">
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
                        <Input placeholder="Ej: Torre A - Principal" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
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
                        >
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
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
                          disabled={!selectedClientId}
                        >
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
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
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue placeholder="Marca">
                              {formData.brands.find((b) => b.id === field.value)?.name ?? null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
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
                  render={({ field }) => (
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
                          <SelectContent>
                            <SelectItem value="">Sin modelo</SelectItem>
                            {formData.models.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name}
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

              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={createForm.control}
                  name="capacityKg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Capacidad (kg)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ej: 630" {...field} value={field.value ?? ""} className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                      </FormControl>
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
                      <FormLabel className="text-xs font-semibold">Velocidad (m/s)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="Ej: 1.6" {...field} value={field.value ?? ""} className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                      </FormControl>
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
                      <FormLabel className="text-xs font-semibold">Paradas</FormLabel>
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
                      <FormLabel className="text-xs font-semibold">Pisos</FormLabel>
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

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setIsCreateOpen(false); setEditingEquipment(null); }}
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
              variant="outline"
              size="sm"
              onClick={() => setDeletingEquipment(null)}
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