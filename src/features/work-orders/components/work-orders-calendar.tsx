"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { type ColumnDef } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  ArrowUpDown,
  Eye,
  Trash2,
  CalendarDays,
  List,
  CalendarClock,
  Clock,
  CheckSquare,
  Building2,
  User2,
  Info,
  Cpu,
} from "lucide-react";

import {
  type WorkOrderWithRelations,
  type WorkOrderElevatorWithRelations,
  type WorkOrdersFormData,
  createWorkOrder,
  updateWorkOrderStatus,
  deleteWorkOrder,
  getNextOtNumber,
} from "../actions";
import { workOrderFormSchema, type WorkOrderFormValues } from "../schema";
import { DataTable } from "@/components/ui/data-table";
import { WorkOrderDetail } from "./work-order-detail";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WorkOrdersCalendarProps {
  initialWorkOrders: WorkOrderWithRelations[];
  formData: WorkOrdersFormData;
  initialWorkOrderElevators: WorkOrderElevatorWithRelations[];
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  IN_PROGRESS: "bg-blue-500/10 text-[#0066CC] dark:text-blue-400 border-[#0066CC]/20",
  REVIEW: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  COMPLETED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  CANCELLED: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  NORMAL: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  LOW: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

const LEGACY_TYPE_LABELS: Record<string, string> = {
  CORRECTIVE: "Correctivo",
  PREVENTIVE: "Preventivo",
  PREDICTIVE: "Predictivo",
  INSTALLATION: "Instalación",
};

const CATEGORY_LABELS: Record<string, string> = {
  EMERGENCIA: "Emergencia",
  MANTENIMIENTO: "Mantenimiento",
  MODERNIZACION: "Modernización",
  PROYECTO: "Proyecto",
};

const CATEGORY_ORDER = ["EMERGENCIA", "MANTENIMIENTO", "MODERNIZACION", "PROYECTO"];

const PRIORITY_LABELS: Record<string, string> = {
  HIGH: "Alta",
  NORMAL: "Normal",
  LOW: "Baja",
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function formatShortDate(date: string | null): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "—";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatScheduled(date: string | null, time: string | null): string {
  if (!date) return "—";
  const base = formatShortDate(date);
  if (!time) return base;
  return `${base} · ${time}`;
}

const emptyValues: WorkOrderFormValues = {
  clientId: "",
  costCenterId: "",
  serviceTypeId: "",
  technicianId: "",
  priority: "NORMAL",
  scheduledDate: "",
  scheduledTime: "",
  elevatorUnityIds: [],
};

export function WorkOrdersCalendar({
  initialWorkOrders,
  formData,
  initialWorkOrderElevators,
}: WorkOrdersCalendarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const todayKey = toISO(new Date());

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [otPreview, setOtPreview] = useState("");
  const [viewingWorkOrder, setViewingWorkOrder] = useState<WorkOrderWithRelations | null>(null);
  const [viewingDay, setViewingDay] = useState<{ iso: string; label: string } | null>(null);
  const [deletingWorkOrder, setDeletingWorkOrder] = useState<WorkOrderWithRelations | null>(null);

  const form = useForm<WorkOrderFormValues>({
    resolver: zodResolver(workOrderFormSchema),
    defaultValues: emptyValues,
  });

  const serviceTypeMap = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string; category: string }>();
    for (const st of formData.serviceTypes) map.set(st.id, st);
    return map;
  }, [formData.serviceTypes]);

  const selectedCostCenterId = form.watch("costCenterId");
  const selectedServiceType = serviceTypeMap.get(form.watch("serviceTypeId"));
  const selectedClientId = form.watch("clientId");

  const costCentersByClient = useMemo(() => {
    if (!selectedClientId) return formData.costCenters;
    return formData.costCenters.filter((cc) => cc.clientId === selectedClientId);
  }, [selectedClientId, formData.costCenters]);

  const equipmentForCostCenter = useMemo(() => {
    if (!selectedCostCenterId) return formData.equipmentOptions;
    return formData.equipmentOptions.filter((e) => e.costCenterId === selectedCostCenterId);
  }, [selectedCostCenterId, formData.equipmentOptions]);

  const typeLabelOf = (type: string | null): string => {
    if (!type) return "—";
    const st = serviceTypeMap.get(type);
    if (st) return `${st.name} (${st.code})`;
    return LEGACY_TYPE_LABELS[type] ?? type;
  };

  const woByDayKey = useMemo(() => {
    const map = new Map<string, WorkOrderWithRelations[]>();
    for (const wo of initialWorkOrders) {
      if (!wo.scheduledDate) continue;
      map.set(wo.scheduledDate, [...(map.get(wo.scheduledDate) ?? []), wo]);
    }
    map.forEach((list) =>
      list.sort((a, b) =>
        `${a.scheduledDate ?? ""} ${a.scheduledTime ?? ""}`.localeCompare(
          `${b.scheduledDate ?? ""} ${b.scheduledTime ?? ""}`
        )
      )
    );
    return map;
  }, [initialWorkOrders]);

  const calCells = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const offset = (firstDow + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date; day: number } | null> = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), day: d });
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentMonth]);

  const monthTitle = currentMonth.toLocaleDateString("es-PE", {
    month: "long",
    year: "numeric",
  });

  function changeMonth(delta: number) {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  async function loadOtPreview(iso: string) {
    const res = await getNextOtNumber(iso);
    setOtPreview(res.otNumber || "");
  }

  function openCreate(date?: Date) {
    const target = date ?? new Date();
    const iso = toISO(target);
    setOtPreview("");
    form.reset({ ...emptyValues, scheduledDate: iso });
    setIsCreateOpen(true);
    void loadOtPreview(iso);
  }

  function handleDateChange(iso: string) {
    form.setValue("scheduledDate", iso);
    void loadOtPreview(iso);
  }

  function handleSubmit(values: WorkOrderFormValues) {
    const st = serviceTypeMap.get(values.serviceTypeId);
    if (st?.code === "PREV" && values.elevatorUnityIds.length === 0) {
      toast.error("Equipos requeridos", {
        description: "Para un mantenimiento preventivo debes seleccionar al menos un equipo.",
      });
      return;
    }
    startTransition(async () => {
      const res = await createWorkOrder(values);
      if (res.success) {
        toast.success("OT creada", { description: res.message });
        setIsCreateOpen(false);
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleStatusChange(workOrder: WorkOrderWithRelations, status: string) {
    startTransition(async () => {
      const res = await updateWorkOrderStatus(workOrder.id, status);
      if (res.success) {
        toast.success("Estado actualizado", {
          description: `La OT ${workOrder.otNumber} cambió a ${status.replace("_", " ").toLowerCase()}.`,
        });
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleDeleteConfirm() {
    if (!deletingWorkOrder) return;
    startTransition(async () => {
      const res = await deleteWorkOrder(deletingWorkOrder.id);
      if (res.success) {
        toast.success("OT eliminada", { description: `Se eliminó ${deletingWorkOrder.otNumber}.` });
        setDeletingWorkOrder(null);
        router.refresh();
      } else {
        toast.error("Error al eliminar", { description: res.error });
      }
    });
  }

  const columns = useMemo<ColumnDef<WorkOrderWithRelations>[]>(
    () => [
      {
        accessorKey: "otNumber",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-xs font-semibold hover:bg-muted/60"
          >
            N° OT
            <ArrowUpDown className="ml-1.5 size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border border-border">
            {row.getValue("otNumber")}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: "Tipo de Servicio",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground font-semibold">
            {typeLabelOf(row.getValue<string>("type"))}
          </span>
        ),
      },
      {
        accessorKey: "client_name",
        header: "Cliente",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground max-w-[180px]">
            <Building2 className="size-3 shrink-0" />
            <span className="truncate">{row.getValue("client_name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "cost_center_name",
        header: "Centro de Costo",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground max-w-[200px]">
            <Building2 className="size-3 shrink-0" />
            <span className="truncate">{row.getValue("cost_center_name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "technician_name",
        header: "Técnico",
        cell: ({ row }) => {
          const tech = row.getValue<string | null>("technician_name");
          return tech ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User2 className="size-3 shrink-0" />
              <span>{tech}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/50">—</span>
          );
        },
      },
      {
        accessorKey: "priority",
        header: "Prioridad",
        cell: ({ row }) => {
          const priority = row.getValue<string>("priority");
          const style = PRIORITY_STYLES[priority] || PRIORITY_STYLES.NORMAL;
          return (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${style}`}>
              {PRIORITY_LABELS[priority] ?? priority}
            </span>
          );
        },
      },
      {
        accessorKey: "scheduledDate",
        header: "Programada",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <CalendarClock className="size-3" />
            {formatScheduled(
              row.getValue<string | null>("scheduledDate"),
              row.original.scheduledTime ?? null
            )}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => {
          const status = row.getValue<string>("status");
          const style = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
          return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${style}`}>
              {status.replace("_", " ")}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => {
          const workOrder = row.original;
          const canStart = workOrder.status === "PENDING";
          const inProgress = workOrder.status === "IN_PROGRESS";
          const notCompleted = workOrder.status !== "COMPLETED" && workOrder.status !== "CANCELLED";
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                variant="outline"
                size="xs"
                onClick={() => setViewingWorkOrder(workOrder)}
                className="h-7 px-2.5 text-xs font-semibold text-[#0066CC] dark:text-blue-400 border-[#0066CC]/30 hover:bg-[#0066CC]/10 gap-1.5 shadow-2xs"
              >
                <Eye className="size-3" />
                Detalle
              </Button>
              {canStart && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => handleStatusChange(workOrder, "IN_PROGRESS")}
                  className="h-7 px-2.5 text-xs font-semibold gap-1.5 shadow-2xs"
                >
                  <Loader2 className="size-3" />
                  Iniciar
                </Button>
              )}
              {inProgress && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => handleStatusChange(workOrder, "REVIEW")}
                  className="h-7 px-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1.5 shadow-2xs"
                >
                  Terminar
                </Button>
              )}
              {notCompleted && workOrder.status !== "REVIEW" && workOrder.status !== "PENDING" && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleStatusChange(workOrder, "COMPLETED")}
                  className="text-emerald-500 hover:text-emerald-700 hover:bg-emerald-500/10"
                  title="Marcar completada"
                >
                  <CheckSquare className="size-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setDeletingWorkOrder(workOrder)}
                className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                title="Eliminar OT"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serviceTypeMap]
  );

  const viewingDayList = useMemo(() => {
    if (!viewingDay) return [];
    return initialWorkOrders.filter((wo) => wo.scheduledDate === viewingDay.iso);
  }, [viewingDay, initialWorkOrders]);

  const elevatorsByWorkOrder = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of initialWorkOrderElevators) {
      map.set(e.workOrderId, (map.get(e.workOrderId) ?? 0) + 1);
    }
    return map;
  }, [initialWorkOrderElevators]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === "calendar"
                ? "bg-[#0066CC] text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <CalendarDays className="size-3.5" />
            Calendario
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === "list"
                ? "bg-[#0066CC] text-white"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <List className="size-3.5" />
            Lista
          </button>
        </div>

        <Button
          onClick={() => openCreate()}
          className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs shrink-0"
        >
          <Plus className="size-4" />
          Nueva OT
        </Button>
      </div>

      {view === "calendar" ? (
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          {/* Navegación de mes */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" onClick={() => changeMonth(-1)} className="size-7" title="Mes anterior">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="icon-sm" onClick={() => changeMonth(1)} className="size-7" title="Mes siguiente">
                <ChevronRight className="size-4" />
              </Button>
              <span className="ml-1 text-sm font-bold capitalize text-foreground">
                {monthTitle}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
              className="text-xs h-8"
            >
              Hoy
            </Button>
          </div>

          {/* Cabecera de días */}
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
              >
                {w}
              </div>
            ))}
          </div>

          {/* Celdas */}
          <div className="mt-1 grid grid-cols-7 gap-1">
            {calCells.map((cell, i) => {
              if (!cell) {
                return <div key={`empty-${i}`} className="min-h-[110px] rounded-lg border border-border/60 bg-muted/20" />;
              }
              const iso = toISO(cell.date);
              const dayWOs = woByDayKey.get(iso) ?? [];
              const isToday = iso === todayKey;
              const visible = dayWOs.slice(0, 3);
              const extraCount = dayWOs.length - visible.length;
              return (
                <div
                  key={iso}
                  onClick={() =>
                    setViewingDay({
                      iso,
                      label: cell.date.toLocaleDateString("es-PE", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }),
                    })
                  }
                  className={`flex min-h-[110px] cursor-pointer flex-col rounded-lg border p-1 transition-colors ${
                    isToday
                      ? "border-[#0066CC] bg-[#0066CC]/5"
                      : "border-border bg-background hover:border-[#0066CC]/40"
                  }`}
                >
                  <div className="flex items-center justify-between px-1 pt-0.5">
                    <span
                      className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${
                        isToday ? "bg-[#0066CC] text-white" : "text-foreground"
                      }`}
                    >
                      {cell.day}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCreate(cell.date);
                      }}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-[#0066CC]"
                      title={`Nueva OT el ${cell.date.toLocaleDateString("es-PE")}`}
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>

                  <div className="mt-1 flex flex-1 flex-col gap-1 overflow-hidden">
                    {visible.map((wo) => {
                      const status = wo.status || "PENDING";
                      const style = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
                      return (
                        <button
                          key={wo.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingWorkOrder(wo);
                          }}
                          title={`${wo.otNumber} — ${typeLabelOf(wo.type)}`}
                          className={`flex w-full items-center gap-1 rounded border px-1.5 py-0.5 text-left text-[9px] font-semibold leading-tight transition-opacity hover:opacity-80 ${style}`}
                        >
                          <Clock className="size-2.5 shrink-0" />
                          <span className="font-mono truncate">{wo.otNumber}</span>
                        </button>
                      );
                    })}
                    {extraCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingDay({ iso, label: cell.date.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" }) });
                        }}
                        className="w-full rounded px-1.5 py-0.5 text-left text-[9px] font-bold text-muted-foreground hover:text-[#0066CC]"
                      >
                        +{extraCount} más
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={initialWorkOrders}
          searchPlaceholder="Buscar por N° OT, cliente, centro de costo o técnico..."
        />
      )}

      {/* Dialog: Crear Orden de Trabajo */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[540px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="size-4 text-[#0066CC]" />
              Nueva Orden de Trabajo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Programa un mantenimiento o atención técnica. El número de OT se genera automáticamente.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Fecha Programada</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value}
                          onChange={(e) => handleDateChange(e.target.value)}
                          className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scheduledTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Hora Programada</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormItem>
                <FormLabel className="text-xs font-semibold">N° de OT (automático)</FormLabel>
                <FormControl>
                  <Input
                    readOnly
                    value={otPreview}
                    placeholder="OT-AAAA-MM-0001"
                    className="bg-muted/40 border-border text-xs font-mono"
                  />
                </FormControl>
              </FormItem>

              <FormField
                control={form.control}
                name="serviceTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Tipo de Servicio</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v ?? "");
                          form.setValue("elevatorUnityIds", []);
                        }}
                      >
                        <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                          <SelectValue placeholder="Selecciona el tipo de servicio">
                            {selectedServiceType && (
                              <>
                                {selectedServiceType.name}
                                <span className="font-mono text-muted-foreground">
                                  ({selectedServiceType.code})
                                </span>
                              </>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_ORDER.map((cat) => {
                            const items = formData.serviceTypes.filter((st) => st.category === cat);
                            if (items.length === 0) return null;
                            return (
                              <SelectGroup key={cat}>
                                <SelectLabel>{CATEGORY_LABELS[cat] ?? cat}</SelectLabel>
                                {items.map((st) => (
                                  <SelectItem key={st.id} value={st.id}>
                                    {st.name}
                                    <span className="font-mono text-muted-foreground">{st.code}</span>
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            );
                          })}
                          {formData.serviceTypes.length === 0 && (
                            <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                              No hay tipos de servicio activos
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedServiceType?.code === "PREV" && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <Info className="size-3.5 mt-0.5 shrink-0" />
                  <span>
                    Preventivo: si el equipo ya tiene un mantenimiento preventivo programado dentro de
                    este mes, no se permitirá registrarlo de nuevo.
                  </span>
                </div>
              )}

              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Cliente</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value || ""}
                        onValueChange={(v) => {
                          const next = v ?? "";
                          field.onChange(next);
                          form.setValue("costCenterId", "");
                          form.setValue("elevatorUnityIds", []);
                        }}
                      >
                        <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                          <SelectValue placeholder="Selecciona el cliente">
                            {formData.clients.find((c) => c.id === field.value)?.legalName ?? null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {formData.clients.length === 0 && (
                            <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                              No hay clientes registrados
                            </div>
                          )}
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
                control={form.control}
                name="costCenterId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Centro de Costo</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                        <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                          <SelectValue placeholder="Selecciona el centro de costo">
                            {costCentersByClient.find((cc) => cc.id === field.value)?.name ?? null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {selectedClientId && costCentersByClient.length === 0 && (
                            <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                              Este cliente no tiene centros de costo
                            </div>
                          )}
                          {!selectedClientId && costCentersByClient.length === 0 && (
                            <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                              No hay centros de costo registrados
                            </div>
                          )}
                          {costCentersByClient.map((cc) => (
                            <SelectItem key={cc.id} value={cc.id}>
                              {cc.name}
                              <span className="font-mono text-muted-foreground">{cc.client_name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="technicianId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Técnico</FormLabel>
                      <FormControl>
                        <Select value={field.value || ""} onValueChange={(v) => field.onChange(v ?? "")}>
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue placeholder="Sin asignar">
                              {formData.technicians.find((t) => t.id === field.value)?.fullName ?? null}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {formData.technicians.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.fullName}
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
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Prioridad</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "NORMAL")}>
                          <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["HIGH", "NORMAL", "LOW"].map((p) => (
                              <SelectItem key={p} value={p}>
                                {PRIORITY_LABELS[p] ?? p}
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
                control={form.control}
                name="elevatorUnityIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Equipos</FormLabel>
                    <FormControl>
                      <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                        {!selectedCostCenterId ? (
                          <div className="rounded-md border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
                            Primero selecciona un centro de costo para ver sus equipos.
                          </div>
                        ) : equipmentForCostCenter.length === 0 ? (
                          <div className="rounded-md border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
                            No hay equipos en el centro de costo seleccionado.
                          </div>
                        ) : (
                          equipmentForCostCenter.map((eq) => (
                            <div
                              key={eq.id}
                              className="flex items-center gap-2.5 rounded-md border border-border px-3 py-1.5"
                            >
                              <Checkbox
                                id={`wo-eq-${eq.id}`}
                                checked={field.value.includes(eq.id)}
                                onCheckedChange={(checked) => {
                                  field.onChange(
                                    checked
                                      ? [...field.value, eq.id]
                                      : field.value.filter((x) => x !== eq.id)
                                  );
                                }}
                              />
                              <Label
                                htmlFor={`wo-eq-${eq.id}`}
                                className="text-xs font-normal cursor-pointer"
                              >
                                <span className="font-mono font-semibold text-foreground">
                                  {eq.internalCode}
                                </span>{" "}
                                — {eq.name}
                              </Label>
                            </div>
                          ))
                        )}
                      </div>
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
                  Crear OT
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Sheet lateral: Detalle del día */}
      <Sheet
        open={!!viewingDay}
        onOpenChange={(o) => {
          if (!o) setViewingDay(null);
        }}
      >
        <SheetContent className="w-full max-w-md bg-card border-border text-foreground">
          <SheetHeader>
            <SheetTitle className="text-base font-bold flex items-center gap-2">
              <CalendarClock className="size-4 text-[#0066CC]" />
              {viewingDay?.label}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              {viewingDayList.length}{" "}
              {viewingDayList.length === 1 ? "orden de trabajo" : "órdenes de trabajo"} programadas
              este día.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {viewingDayList.length === 0 && (
              <div className="rounded-md border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
                Sin órdenes de trabajo este día.
              </div>
            )}
            {viewingDayList.map((wo) => {
              const status = wo.status || "PENDING";
              const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.PENDING;
              const priority = wo.priority || "NORMAL";
              const priorityStyle = PRIORITY_STYLES[priority] || PRIORITY_STYLES.NORMAL;
              const equipmentCount = elevatorsByWorkOrder.get(wo.id) ?? 0;
              return (
                <div key={wo.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">
                      {wo.otNumber}
                    </span>
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${statusStyle}`}
                    >
                      {status.replace("_", " ")}
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs font-semibold text-foreground">
                    {typeLabelOf(wo.type)}
                  </p>

                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Building2 className="size-3 shrink-0 text-[#0066CC]" />
                      <span title={wo.client_name ?? ""} className="truncate">
                        {wo.client_name ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User2 className="size-3 shrink-0 text-[#0066CC]" />
                      <span className="truncate">{wo.technician_name ?? "Sin técnico"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0 col-span-2">
                      <Building2 className="size-3 shrink-0 text-muted-foreground/50" />
                      <span className="truncate">{wo.cost_center_name}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${priorityStyle}`}
                    >
                      Prioridad {PRIORITY_LABELS[priority] ?? priority}
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border border-border bg-muted/40 text-muted-foreground">
                      <Cpu className="size-2.5" />
                      {equipmentCount} {equipmentCount === 1 ? "equipo" : "equipos"}
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border border-border bg-muted/40 text-muted-foreground">
                      <CalendarClock className="size-2.5" />
                      {formatScheduled(wo.scheduledDate, wo.scheduledTime ?? null)}
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      setViewingDay(null);
                      setViewingWorkOrder(wo);
                    }}
                    className="mt-3 h-7 w-full px-2.5 text-xs font-semibold text-[#0066CC] dark:text-blue-400 border-[#0066CC]/30 hover:bg-[#0066CC]/10 gap-1.5"
                  >
                    <Eye className="size-3" />
                    Ver detalle completo
                  </Button>
                </div>
              );
            })}
          </div>

          {viewingDay && (
            <SheetFooter className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setViewingDay(null);
                  openCreate(
                    (() => {
                      const [y, m, d] = viewingDay.iso.split("-").map(Number);
                      return new Date(y, m - 1, d);
                    })()
                  );
                }}
                className="w-full text-xs border-border"
              >
                <Plus className="size-3.5" />
                Nueva OT este día
              </Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog: Detalle de la OT */}
      {viewingWorkOrder && (
        <WorkOrderDetail
          workOrder={viewingWorkOrder}
          workOrderElevators={initialWorkOrderElevators.filter(
            (e) => e.workOrderId === viewingWorkOrder.id
          )}
          serviceTypes={formData.serviceTypes}
          onClose={() => setViewingWorkOrder(null)}
        />
      )}

      {/* Dialog: Confirmar Eliminación */}
      <Dialog
        open={!!deletingWorkOrder}
        onOpenChange={(o) => !o && setDeletingWorkOrder(null)}
      >
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="size-4 text-red-600 dark:text-red-400" />
              Eliminar OT
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Confirmas la eliminación de la orden de trabajo{" "}
              <strong className="text-foreground font-mono">{deletingWorkOrder?.otNumber}</strong>?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingWorkOrder(null)}
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