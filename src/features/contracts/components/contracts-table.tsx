"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { type Client, type ServiceType } from "@/db";
import { 
  type ContractWithRelations,
  type ContractElevatorWithRelations,
  createContract,
  updateContract,
  cancelContract,
} from "../actions";
import { contractFormSchema, type ContractFormValues } from "../schema";
import { DataTable } from "@/components/ui/data-table";
import { ContractElevatorsTable } from "./contract-elevators-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Plus,
  Pencil,
  Ban,
  Loader2,
  FileSignature,
  ArrowUpDown,
  MapPin,
  Eye,
  ChevronLeft,
  FileText,
} from "lucide-react";

export type CostCenterOption = { id: string; clientId: string; name: string; address: string | null; client_name: string | null };

interface ContractsTableProps {
  initialContracts: ContractWithRelations[];
  clients: Client[];
  costCenters: CostCenterOption[];
  serviceTypes: ServiceType[];
  initialContractElevators: ContractElevatorWithRelations[];
  equipmentOptions: Array<{
    id: string;
    costCenterId: string;
    internalCode: string;
    name: string;
    manufacturerSerial: string | null;
    brand_name: string | null;
    model_name: string | null;
    elevator_type_name: string | null;
    cost_center_name: string | null;
    client_name: string | null;
    capacityPersons: number | null;
    capacityKg: number | null;
    speedMs: number | null;
    stops: number | null;
    floors: number | null;
    tractionType: string | null;
    yearOfFabrication: number | null;
    status: string | null;
    installationDate: number | null;
  }>;
}

type ContractTab = "ACTIVE" | "DRAFT" | "HISTORY";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  DRAFT: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  EXPIRED: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  CANCELLED: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  DRAFT: "Borrador",
  EXPIRED: "Vencido",
  CANCELLED: "Cancelado",
};

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(currency: string, amount: number): string {
  return `${currency} ${amount.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

const createDefaultValues = (): ContractFormValues => ({
  costCenterId: "",
  status: "ACTIVE",
  serviceTypeId: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  autoRenewal: true,
  noticePeriodDays: 30,
  currency: "PEN",
  baseAmount: 0,
  includesIgv: true,
  paymentTermsDays: 5,
  inflationAdjustment: true,
  slaEntrapmentMins: 45,
  slaMechanicalFailureMins: 180,
});

export function ContractsTable({
  initialContracts,
  clients,
  costCenters,
  serviceTypes,
  initialContractElevators,
  equipmentOptions,
}: ContractsTableProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [editingContract, setEditingContract] = useState<ContractWithRelations | null>(null);
  const [cancellingContract, setCancellingContract] = useState<ContractWithRelations | null>(null);
  const [viewingContract, setViewingContract] = useState<ContractWithRelations | null>(null);
  const [activeTab, setActiveTab] = useState<ContractTab>("ACTIVE");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const tabs = useMemo<Array<{ key: ContractTab; label: string; predicate: (c: ContractWithRelations) => boolean }>>(
    () => [
      {
        key: "ACTIVE",
        label: "Activos",
        predicate: (c) => c.deletedAt == null && c.status === "ACTIVE",
      },
      {
        key: "DRAFT",
        label: "Borradores",
        predicate: (c) => c.deletedAt == null && c.status === "DRAFT",
      },
      {
        key: "HISTORY",
        label: "Histórico",
        predicate: (c) =>
          c.deletedAt != null || c.status === "EXPIRED" || c.status === "CANCELLED",
      },
    ],
    []
  );

  const tabCounts = useMemo(() => {
    const counts: Record<ContractTab, number> = { ACTIVE: 0, DRAFT: 0, HISTORY: 0 };
    for (const c of initialContracts) {
      for (const t of tabs) {
        if (t.predicate(c)) counts[t.key]++;
      }
    }
    return counts;
  }, [initialContracts, tabs]);

  const visibleContracts = useMemo(
    () => initialContracts.filter(tabs.find((t) => t.key === activeTab)!.predicate),
    [initialContracts, activeTab, tabs]
  );

  const createForm = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: createDefaultValues(),
  });

  const filteredCostCenters = useMemo(
    () => costCenters.filter((cc) => cc.clientId === selectedClientId),
    [costCenters, selectedClientId]
  );

  function handleOpenCreate() {
    createForm.reset(createDefaultValues());
    setSelectedClientId("");
    setIsCreateOpen(true);
  }

  function handleOpenEdit(contract: ContractWithRelations) {
    setSelectedClientId(costCenters.find((cc) => cc.id === contract.costCenterId)?.clientId ?? "");
    setEditingContract(contract);
    setIsCreateOpen(true);
    createForm.reset({
      costCenterId: contract.costCenterId,
      status: contract.status || "ACTIVE",
      serviceTypeId: contract.serviceTypeId,
      startDate: contract.startDate
        ? new Date(contract.startDate * 1000).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      endDate: contract.endDate
        ? new Date(contract.endDate * 1000).toISOString().slice(0, 10)
        : "",
      autoRenewal: contract.autoRenewal ?? true,
      noticePeriodDays: contract.noticePeriodDays ?? 30,
      currency: contract.currency || "PEN",
      baseAmount: contract.baseAmount ?? 0,
      includesIgv: contract.includesIgv ?? true,
      paymentTermsDays: contract.paymentTermsDays ?? 5,
      inflationAdjustment: contract.inflationAdjustment ?? true,
      slaEntrapmentMins: contract.slaEntrapmentMins ?? 45,
      slaMechanicalFailureMins: contract.slaMechanicalFailureMins ?? 180,
    });
  }

  function handleSubmit(values: ContractFormValues) {
    startTransition(async () => {
      const res = editingContract
        ? await updateContract(editingContract.id, values)
        : await createContract(values);
      if (res.success) {
        toast.success(editingContract ? "Contrato actualizado" : "Contrato creado", {
          description: res.message,
        });
        setIsCreateOpen(false);
        setEditingContract(null);
        createForm.reset();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleCancelConfirm() {
    if (!cancellingContract) return;
    startTransition(async () => {
      const res = await cancelContract(cancellingContract.id);
      if (res.success) {
        toast.success("Contrato anulado", { description: res.message });
        setCancellingContract(null);
      } else {
        toast.error("Error al anular", { description: res.error });
      }
    });
  }

  const columns = useMemo<ColumnDef<ContractWithRelations>[]>(
    () => [
      {
        accessorKey: "contractNumber",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-xs font-semibold hover:bg-muted/60"
          >
            N° Contrato
            <ArrowUpDown className="ml-1.5 size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border border-border">
            {row.getValue("contractNumber")}
          </span>
        ),
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
        accessorKey: "service_type_name",
        header: "Servicio",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.getValue("service_type_name")}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => {
          const status = row.getValue<string>("status");
          const style = STATUS_STYLES[status] || STATUS_STYLES.DRAFT;
          return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${style}`}>
              {STATUS_LABELS[status] ?? status}
            </span>
          );
        },
      },
      {
        accessorKey: "baseAmount",
        header: "Monto",
        cell: ({ row }) => {
          const currency = row.original.currency || "PEN";
          const amount = row.getValue<number>("baseAmount");
          return (
            <span className="text-xs font-mono font-semibold">{formatAmount(currency, amount)}</span>
          );
        },
      },
      {
        accessorKey: "startDate",
        header: "Inicio",
        cell: ({ row }) => (
          <span className="text-xs font-mono text-muted-foreground">
            {formatDate(row.getValue<number | null>("startDate"))}
          </span>
        ),
      },
      {
        accessorKey: "endDate",
        header: "Fin",
        cell: ({ row }) => (
          <span className="text-xs font-mono text-muted-foreground">
            {formatDate(row.getValue<number | null>("endDate"))}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => {
          const contract = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                variant="outline"
                size="xs"
                onClick={() => router.push(`/contracts/${contract.id}`)}
                className="h-7 px-2.5 text-xs font-semibold text-[#810303] dark:text-red-400 border-[#810303]/30 hover:bg-[#810303]/10 gap-1.5 shadow-2xs"
              >
                <FileText className="size-3" />
                Documento
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setViewingContract(contract)}
                className="h-7 px-2.5 text-xs font-semibold text-[#0066CC] dark:text-blue-400 border-[#0066CC]/30 hover:bg-[#0066CC]/10 gap-1.5 shadow-2xs"
              >
                <Eye className="size-3" />
                Equipos
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleOpenEdit(contract)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Editar contrato"
              >
                <Pencil className="size-3.5" />
              </Button>
              {contract.status !== "CANCELLED" && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setCancellingContract(contract)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                  title="Anular contrato"
                >
                  <Ban className="size-3.5" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router]
  );

  const viewingContractElevators = viewingContract
    ? initialContractElevators.filter((ce) => ce.contractId === viewingContract.id)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ContractTab)}>
          <TabsList variant="line" className="h-9">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="px-3 text-xs">
                {t.label}
                <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-[#0066CC]/10 text-[#0066CC] dark:text-blue-400 text-[10px] font-bold">
                  {tabCounts[t.key]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <DataTable
        columns={columns}
        data={visibleContracts}
        searchPlaceholder="Buscar por número, centro de costo o servicio..."
        extraActions={
          <Button
            onClick={handleOpenCreate}
            className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs shrink-0"
          >
            <Plus className="size-4" />
            Nuevo Contrato
          </Button>
        }
      />

      {/* Modal: Crear/Editar Contrato */}
      <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (!o) setEditingContract(null); }}>
        <DialogContent className="bg-card border-border sm:max-w-[640px] text-foreground shadow-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {editingContract ? (
                <Pencil className="size-4 text-[#0066CC]" />
              ) : (
                <Plus className="size-4 text-[#0066CC]" />
              )}
              {editingContract ? "Editar Contrato" : "Nuevo Contrato"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingContract ? (
                <>Modifica el contrato <strong className="font-mono">{editingContract.contractNumber}</strong>.</>
              ) : (
                "El número de contrato se genera automáticamente."
              )}
            </DialogDescription>
          </DialogHeader>

          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="costCenterId"
                  render={() => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Cliente</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          items={clients}
                          value={selectedClientId}
                          onValueChange={(v) => {
                            setSelectedClientId(v);
                            createForm.setValue("costCenterId", "");
                          }}
                          getValue={(c) => c.id}
                          getLabel={(c) => c.legalName}
                          getKeywords={(c) => c.taxId}
                          placeholder="Selecciona el cliente"
                          searchPlaceholder="Buscar cliente..."
                          emptyText="No hay clientes registrados"
                          allowClear
                          clearLabel="Selecciona el cliente"
                        />
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
                        <SearchableSelect
                          items={filteredCostCenters}
                          value={field.value ?? ""}
                          onValueChange={(v) => field.onChange(v)}
                          getValue={(cc) => cc.id}
                          getLabel={(cc) => cc.name}
                          getKeywords={(cc) => cc.address}
                          placeholder={
                            selectedClientId
                              ? "Selecciona el centro de costo"
                              : "Primero elige el cliente"
                          }
                          searchPlaceholder="Buscar centro de costo..."
                          emptyText="Este cliente no tiene centros de costo"
                          disabled={!selectedClientId}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="serviceTypeId"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="text-xs font-semibold">Tipo de Servicio</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue placeholder="Selecciona el tipo de servicio">
                              {serviceTypes.find((st) => st.id === field.value)?.name ?? null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {serviceTypes
                              .filter((st) => ["PREV", "MOD_TOT", "INST"].includes(st.code))
                              .map((st) => (
                                <SelectItem key={st.id} value={st.id}>
                                  {st.name}
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

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Fecha Inicio</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value ?? ""}
                          onChange={(v) => field.onChange(v)}
                          className="text-xs"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Fecha Fin</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value ?? ""}
                          onChange={(v) => field.onChange(v)}
                          className="text-xs"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="baseAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Monto Base</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Moneda</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["PEN", "USD"].map((c) => (
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

              <div className="grid grid-cols-2 gap-3">
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
                              {field.value ? (STATUS_LABELS[field.value] ?? field.value) : null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {["ACTIVE", "DRAFT", "EXPIRED", "CANCELLED"].map((s) => (
                              <SelectItem key={s} value={s}>
                                {STATUS_LABELS[s] ?? s}
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
                  name="noticePeriodDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Días de Notificación</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="paymentTermsDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Días de Pago</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="autoRenewal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Renovación Automática</FormLabel>
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="includesIgv"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Incluye IGV</FormLabel>
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
                  name="inflationAdjustment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Reajuste Anual (IPC)</FormLabel>
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={createForm.control}
                  name="slaEntrapmentMins"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">SLA Atrapamiento (min)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="slaMechanicalFailureMins"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">SLA Falla Mecánica (min)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]" />
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
                  onClick={() => { setIsCreateOpen(false); setEditingContract(null); }}
                  className="text-xs border-border"
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={isPending} className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2">
                  {isPending && <Loader2 className="size-3.5 animate-spin" />}
                  {editingContract ? "Guardar Cambios" : "Crear Contrato"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal: Ver Equipos del Contrato */}
      <Dialog open={!!viewingContract} onOpenChange={(open) => !open && setViewingContract(null)}>
        <DialogContent showCloseButton={false} className="!max-w-[1280px] w-full bg-card border-border text-foreground shadow-lg max-h-[94vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileSignature className="size-4 text-[#0066CC]" />
              Equipos del Contrato {viewingContract?.contractNumber}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {viewingContract?.cost_center_name} — {viewingContract?.service_type_name}
            </DialogDescription>
            <button
              onClick={() => setViewingContract(null)}
              className="absolute top-3 right-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1 bg-card"
            >
              <ChevronLeft className="size-3" />
              Cerrar
            </button>
          </DialogHeader>

          <ContractElevatorsTable
            key={viewingContract?.id ?? "none"}
            contract={viewingContract}
            contractElevators={viewingContractElevators}
            equipmentOptions={equipmentOptions}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Anulación */}
      <Dialog open={!!cancellingContract} onOpenChange={(open) => !open && setCancellingContract(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[440px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <Ban className="size-4 text-red-600 dark:text-red-400" />
              Anular Contrato
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Vas a anular el contrato{" "}
              <strong className="text-foreground font-mono">{cancellingContract?.contractNumber}</strong>.
              Esto desvinculará sus equipos, quitará las paradas de rutas preventivas asociadas y
              eliminará las OTs preventivas <strong className="text-foreground">pendientes y futuras</strong>{" "}
              (el histórico ejecutado se conserva). Podrás crear un contrato nuevo y reasignar los equipos.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setCancellingContract(null)} className="text-xs border-border">
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={isPending} onClick={handleCancelConfirm} className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold gap-2">
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Anular Contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}