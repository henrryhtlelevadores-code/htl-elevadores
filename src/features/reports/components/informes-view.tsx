"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  type CompletedWorkOrderReport,
  type ReportElevator,
  type ReportElevatorTask,
  updateElevatorFinding,
  updateWorkOrderClosingNotes,
  updateTaskObservation,
  addEvidencePhotos,
  removeEvidencePhoto,
} from "../actions";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { fileToCompressedDataUrl } from "@/features/technician/lib/media";
import {
  ArrowUpDown,
  Building2,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Circle,
  ClipboardList,
  Cpu,
  FileText,
  Loader2,
  MapPin,
  PenLine,
  StickyNote,
  User,
  X,
} from "lucide-react";

interface InformesViewProps {
  workOrders: CompletedWorkOrderReport[];
  clients: Array<{ id: string; legalName: string }>;
  costCenters: Array<{
    id: string;
    name: string;
    clientId: string;
    client_name: string;
  }>;
}

const MAX_EVIDENCE_PER_ELEVATOR = 10;

const PRIORITY_LABELS: Record<string, string> = {
  HIGH: "Alta",
  NORMAL: "Normal",
  LOW: "Baja",
};

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Completada",
  IN_PROGRESS: "En curso",
  PENDING: "Pendiente",
  CANCELLED: "Cancelada",
};

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDayTime(date: string | null, time?: string | null): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(y, m - 1, d).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return time ? `${base} · ${time}` : base;
}

function InfoChip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-xs font-bold truncate">{value}</div>
    </div>
  );
}

export function InformesView({
  workOrders,
  clients,
  costCenters,
}: InformesViewProps) {
  const [data, setData] = useState<CompletedWorkOrderReport[]>(workOrders);
  const [clientFilter, setClientFilter] = useState("");
  const [ccFilter, setCcFilter] = useState("");

  const [viewingId, setViewingId] = useState<string | null>(null);

  const [notesDraft, setNotesDraft] = useState("");
  const [findingsDraft, setFindingsDraft] = useState<Record<string, string>>({});
  const [taskObsDraft, setTaskObsDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoTargetId, setPhotoTargetId] = useState<string | null>(null);

  const filteredCostCenters = useMemo(
    () =>
      clientFilter
        ? costCenters.filter((cc) => cc.clientId === clientFilter)
        : costCenters,
    [clientFilter, costCenters]
  );

  const filteredWorkOrders = useMemo(
    () =>
      data.filter(
        (wo) =>
          (!clientFilter || wo.clientId === clientFilter) &&
          (!ccFilter || wo.costCenterId === ccFilter)
      ),
    [data, clientFilter, ccFilter]
  );

  const viewing = useMemo(
    () => data.find((wo) => wo.id === viewingId) ?? null,
    [data, viewingId]
  );

  function setBusyKey(key: string, value: boolean) {
    setBusy((prev) => ({ ...prev, [key]: value }));
  }

  function patchWorkOrder(
    workOrderId: string,
    patch: (wo: CompletedWorkOrderReport) => CompletedWorkOrderReport
  ) {
    setData((prev) => prev.map((wo) => (wo.id === workOrderId ? patch(wo) : wo)));
  }

  const handleOpen = useCallback((wo: CompletedWorkOrderReport) => {
    setViewingId(wo.id);
    setNotesDraft(wo.closingNotes ?? "");
    setFindingsDraft(
      Object.fromEntries(wo.elevators.map((e) => [e.id, e.finding ?? ""]))
    );
    const obs: Record<string, string> = {};
    for (const ev of wo.elevators) {
      for (const t of ev.tasks) obs[t.id] = t.observations ?? "";
    }
    setTaskObsDraft(obs);
  }, []);

  async function handleSaveNotes() {
    if (!viewing) return;
    const key = "notes";
    setBusyKey(key, true);
    try {
      const res = await updateWorkOrderClosingNotes(viewing.id, notesDraft);
      if (res.success) {
        const value = notesDraft.trim();
        patchWorkOrder(viewing.id, (wo) => ({ ...wo, closingNotes: value || null }));
        toast.success("Notas guardadas", { description: res.message });
      } else {
        toast.error("Error", { description: res.error });
      }
    } finally {
      setBusyKey(key, false);
    }
  }

  async function handleSaveFinding(elevator: ReportElevator) {
    const key = `finding:${elevator.id}`;
    setBusyKey(key, true);
    try {
      const value = findingsDraft[elevator.id] ?? "";
      const res = await updateElevatorFinding(elevator.id, value);
      if (res.success) {
        patchWorkOrder(elevator.workOrderId, (wo) => ({
          ...wo,
          elevators: wo.elevators.map((e) =>
            e.id === elevator.id ? { ...e, finding: value.trim() || null } : e
          ),
        }));
        toast.success("Hallazgos guardados", { description: res.message });
      } else {
        toast.error("Error", { description: res.error });
      }
    } finally {
      setBusyKey(key, false);
    }
  }

  async function handleSaveTaskObservation(
    task: ReportElevatorTask,
    elevator: ReportElevator
  ) {
    const key = `task:${task.id}`;
    setBusyKey(key, true);
    try {
      const value = taskObsDraft[task.id] ?? "";
      const res = await updateTaskObservation(task.id, value);
      if (res.success) {
        patchWorkOrder(elevator.workOrderId, (wo) => ({
          ...wo,
          elevators: wo.elevators.map((e) =>
            e.id === elevator.id
              ? {
                  ...e,
                  tasks: e.tasks.map((t) =>
                    t.id === task.id
                      ? { ...t, observations: value.trim() || null }
                      : t
                  ),
                }
              : e
          ),
        }));
        toast.success("Observación guardada", { description: res.message });
      } else {
        toast.error("Error", { description: res.error });
      }
    } finally {
      setBusyKey(key, false);
    }
  }

  async function handleAddPhotos(
    elevator: ReportElevator,
    files: FileList | null
  ) {
    if (!elevator || !files || files.length === 0) return;
    const remaining =
      MAX_EVIDENCE_PER_ELEVATOR - (elevator.evidencePhotoUrls?.length ?? 0);
    if (remaining <= 0) {
      toast.error("Límite alcanzado", {
        description: `Máximo ${MAX_EVIDENCE_PER_ELEVATOR} fotos por equipo.`,
      });
      return;
    }
    const key = `upload:${elevator.id}`;
    setBusyKey(key, true);
    try {
      const images = await Promise.all(
        Array.from(files)
          .slice(0, Math.min(4, remaining))
          .map((file) => fileToCompressedDataUrl(file))
      );
      const res = await addEvidencePhotos(elevator.workOrderId, elevator.id, images);
      if (res.success && res.urls) {
        patchWorkOrder(elevator.workOrderId, (wo) => ({
          ...wo,
          elevators: wo.elevators.map((e) =>
            e.id === elevator.id
              ? {
                  ...e,
                  evidencePhotoUrls: [...e.evidencePhotoUrls, ...(res.urls ?? [])],
                }
              : e
          ),
        }));
        toast.success(res.message);
      } else {
        toast.error("Error", { description: res.error });
      }
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "No se pudieron subir las fotos.",
      });
    } finally {
      setBusyKey(key, false);
      setPhotoTargetId(null);
    }
  }

  async function handleRemovePhoto(elevator: ReportElevator, url: string) {
    const previous = elevator.evidencePhotoUrls;
    const optimistic = elevator.evidencePhotoUrls.filter((u) => u !== url);
    patchWorkOrder(elevator.workOrderId, (wo) => ({
      ...wo,
      elevators: wo.elevators.map((e) =>
        e.id === elevator.id ? { ...e, evidencePhotoUrls: optimistic } : e
      ),
    }));
    const res = await removeEvidencePhoto(elevator.id, url);
    if (res.success) {
      toast.success(res.message);
    } else {
      patchWorkOrder(elevator.workOrderId, (wo) => ({
        ...wo,
        elevators: wo.elevators.map((e) =>
          e.id === elevator.id ? { ...e, evidencePhotoUrls: previous } : e
        ),
      }));
      toast.error("Error", { description: res.error });
    }
  }

  const columns = useMemo<ColumnDef<CompletedWorkOrderReport>[]>(
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
            OT
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
        accessorKey: "client_name",
        header: "Cliente",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-xs text-foreground max-w-[180px]">
            <Building2 className="size-3.5 text-[#0066CC] shrink-0" />
            <span className="truncate font-semibold">{row.getValue("client_name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "cost_center_name",
        header: "Centro de Costo",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground max-w-[160px]">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{row.getValue("cost_center_name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "technician_name",
        header: "Técnico",
        cell: ({ row }) => {
          const name = row.getValue<string | null>("technician_name");
          return name ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="size-3 shrink-0" />
              <span className="truncate">{name}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/50">—</span>
          );
        },
      },
      {
        id: "evidence",
        header: "Detalle",
        cell: ({ row }) => {
          const elevators = row.original.elevators;
          const photos = elevators.reduce(
            (acc, e) => acc + (e.evidencePhotoUrls?.length ?? 0),
            0
          );
          return (
            <span className="text-xs text-muted-foreground">
              {elevators.length} equipo(s) · {photos} foto(s)
            </span>
          );
        },
      },
      {
        accessorKey: "completedAt",
        header: "Completada",
        cell: ({ row }) => (
          <span className="text-xs font-mono text-muted-foreground">
            {formatDate(row.getValue<number | null>("completedAt"))}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleOpen(row.original)}
              className="h-7 px-2.5 text-xs font-semibold text-[#0066CC] dark:text-blue-400 border-[#0066CC]/30 hover:bg-[#0066CC]/10 gap-1.5 shadow-2xs"
            >
              <PenLine className="size-3" />
              Revisar
            </Button>
          </div>
        ),
      },
    ],
    [handleOpen]
  );

  const totalPhotos = useMemo(
    () => viewing?.elevators.reduce((acc, e) => acc + e.evidencePhotoUrls.length, 0) ?? 0,
    [viewing]
  );

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Filtrar:
          </span>
          <SearchableSelect
            items={clients}
            value={clientFilter}
            onValueChange={(v) => {
              setClientFilter(v);
              setCcFilter("");
            }}
            getValue={(c) => c.id}
            getLabel={(c) => c.legalName}
            placeholder="Todos los clientes"
            searchPlaceholder="Buscar cliente..."
            emptyText="No hay clientes registrados"
            allowClear
            clearLabel="Todos los clientes"
            className="h-7 sm:w-[220px]"
          />

          <SearchableSelect
            items={filteredCostCenters}
            value={ccFilter}
            onValueChange={(v) => setCcFilter(v)}
            getValue={(cc) => cc.id}
            getLabel={(cc) => cc.name}
            getKeywords={(cc) => cc.client_name}
            placeholder="Todos los centros de costo"
            searchPlaceholder="Buscar centro de costo..."
            emptyText="No hay centros de costo para este cliente"
            allowClear
            clearLabel="Todos los centros de costo"
            className="h-7 sm:w-[220px]"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredWorkOrders}
        searchPlaceholder="Buscar por OT, cliente o técnico..."
      />

      {/* Modal: Revisar Informe (OT completada) */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewingId(null)}>
        <DialogContent
          showCloseButton={false}
          className="bg-card border-border sm:max-w-[820px] text-foreground shadow-lg max-h-[92vh] overflow-y-auto"
        >
          <button
            onClick={() => setViewingId(null)}
            className="absolute top-3 right-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1 bg-card"
          >
            <ChevronLeft className="size-3" />
            Cerrar
          </button>

          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <ClipboardList className="size-4 text-[#0066CC]" />
                  {viewing.otNumber}
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    Completada
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {viewing.client_name} — {viewing.cost_center_name}
                  {viewing.technician_name
                    ? ` — Técnico: ${viewing.technician_name}`
                    : ""}
                </DialogDescription>
              </DialogHeader>

              {/* Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                <InfoChip label="Tipo" value={viewing.serviceTypeName ?? "—"} />
                <InfoChip
                  label="Prioridad"
                  value={PRIORITY_LABELS[viewing.priority ?? ""] ?? viewing.priority ?? "—"}
                />
                <InfoChip
                  label="Programada"
                  value={formatDayTime(viewing.scheduledDate, viewing.scheduledTime)}
                />
                <InfoChip
                  label="Inicio"
                  value={viewing.startedAt ? formatDate(viewing.startedAt) : "—"}
                />
                <InfoChip
                  label="Completada"
                  value={viewing.completedAt ? formatDate(viewing.completedAt) : "—"}
                />
                <InfoChip
                  label="Estado"
                  value={STATUS_LABELS[viewing.status ?? ""] ?? viewing.status ?? "—"}
                />
              </div>

              {/* Firma del cliente */}
              {(viewing.clientSignatureUrl || viewing.clientSignerName) && (
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-center gap-4">
                  {viewing.clientSignatureUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={viewing.clientSignatureUrl}
                      alt="Firma del cliente"
                      className="h-16 w-40 object-contain bg-white border border-border rounded-lg"
                    />
                  )}
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Firma del cliente
                    </div>
                    <div className="text-xs font-bold">
                      {viewing.clientSignerName || "Sin nombre registrado"}
                    </div>
                  </div>
                </div>
              )}

              {/* Notas de cierre */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <StickyNote className="size-3.5" />
                    Notas de cierre
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={handleSaveNotes}
                    disabled={busy["notes"]}
                    className="text-xs font-semibold gap-1.5"
                  >
                    {busy["notes"] ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3" />
                    )}
                    Guardar
                  </Button>
                </div>
                <Textarea
                  rows={3}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Notas de cierre de la orden..."
                  className="bg-card border-border text-xs leading-relaxed focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                />
              </div>

              {/* Equipos atendidos */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Cpu className="size-3.5" />
                  Equipos atendidos ({viewing.elevators.length}) · {totalPhotos}{" "}
                  foto(s)
                </div>
                {viewing.elevators.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 py-8 text-center">
                    <Cpu className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground font-semibold">
                      No hay equipos asignados a esta OT
                    </p>
                  </div>
                ) : (
                  viewing.elevators.map((elevator) => (
                    <ElevatorReviewCard
                      key={elevator.id}
                      elevator={elevator}
                      finding={findingsDraft[elevator.id] ?? ""}
                      onFindingChange={(value) =>
                        setFindingsDraft((prev) => ({ ...prev, [elevator.id]: value }))
                      }
                      taskObsDraft={taskObsDraft}
                      onTaskObsChange={(taskId, value) =>
                        setTaskObsDraft((prev) => ({ ...prev, [taskId]: value }))
                      }
                      busy={busy}
                      onPhotoTarget={(id) => {
                        setPhotoTargetId(id);
                        if (fileRef.current) fileRef.current.click();
                      }}
                      onSaveFinding={() => handleSaveFinding(elevator)}
                      onRemovePhoto={(url) => handleRemovePhoto(elevator, url)}
                      onSaveTask={(task) =>
                        handleSaveTaskObservation(task, elevator)
                      }
                    />
                  ))
                )}
              </div>

              {/* Input oculto para fotos */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const target = viewing.elevators.find(
                    (ev) => ev.id === photoTargetId
                  );
                  if (target) handleAddPhotos(target, e.target.files);
                  e.target.value = "";
                }}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ElevatorReviewCard({
  elevator,
  finding,
  onFindingChange,
  taskObsDraft,
  onTaskObsChange,
  busy,
  onPhotoTarget,
  onSaveFinding,
  onRemovePhoto,
  onSaveTask,
}: {
  elevator: ReportElevator;
  finding: string;
  onFindingChange: (value: string) => void;
  taskObsDraft: Record<string, string>;
  onTaskObsChange: (taskId: string, value: string) => void;
  busy: Record<string, boolean>;
  onPhotoTarget: (id: string) => void;
  onSaveFinding: () => void;
  onRemovePhoto: (url: string) => void;
  onSaveTask: (task: ReportElevatorTask) => void;
}) {
  const completedTasks = elevator.tasks.filter((t) => t.isCompleted).length;
  const finalStatusLabel =
    elevator.finalStatus === "OUT_OF_SERVICE"
      ? "Fuera de servicio"
      : elevator.finalStatus === "OPERATIVE"
        ? "Operativo"
        : "—";

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      {/* Encabezado del equipo */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/20">
        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border border-border">
          {elevator.internalCode}
        </span>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Cpu className="size-3.5 text-[#0066CC] shrink-0" />
          <span className="text-xs font-semibold truncate">{elevator.elevatorName}</span>
        </div>
        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
          {finalStatusLabel}
        </span>
        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
          {completedTasks}/{elevator.tasks.length} tareas
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* Hallazgos */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <StickyNote className="size-3.5" />
              Hallazgos
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={onSaveFinding}
              disabled={busy[`finding:${elevator.id}`]}
              className="text-xs font-semibold gap-1.5"
            >
              {busy[`finding:${elevator.id}`] ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3" />
              )}
              Guardar
            </Button>
          </div>
          <Textarea
            rows={2}
            value={finding}
            onChange={(e) => onFindingChange(e.target.value)}
            placeholder="Hallazgos de la intervención..."
            className="bg-card border-border text-xs leading-relaxed focus-visible:ring-1 focus-visible:ring-[#0066CC]"
          />
        </div>

        {/* Evidencias */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Camera className="size-3.5" />
              Evidencias ({elevator.evidencePhotoUrls.length})
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => onPhotoTarget(elevator.id)}
              disabled={busy[`upload:${elevator.id}`]}
              className="text-xs font-semibold gap-1.5"
            >
              {busy[`upload:${elevator.id}`] ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Camera className="size-3" />
              )}
              Agregar fotos
            </Button>
          </div>
          {elevator.evidencePhotoUrls.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic py-1">
              Sin evidencias fotográficas.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {elevator.evidencePhotoUrls.map((url, idx) => (
                <div key={url} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Evidencia ${idx + 1}`}
                    className="aspect-square w-full object-cover rounded-lg border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => onRemovePhoto(url)}
                    className="absolute top-1 right-1 size-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="Quitar foto"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checklist con observaciones */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ClipboardList className="size-3.5" />
            Checklist
          </div>
          {elevator.tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic py-1">
              Sin tareas registradas para este equipo.
            </p>
          ) : (
            <div className="space-y-1">
              {elevator.tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-border bg-muted/20 px-2.5 py-2 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    {task.isCompleted ? (
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <span
                      className={cn(
                        "text-xs flex-1",
                        task.isCompleted &&
                          "line-through text-muted-foreground/60"
                      )}
                    >
                      {task.taskDescription}
                      {task.isCritical && (
                        <span className="ml-1.5 text-[9px] font-bold uppercase text-red-500 border border-red-500/30 rounded px-1 py-0.5 bg-red-500/10">
                          Crítica
                        </span>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onSaveTask(task)}
                      disabled={busy[`task:${task.id}`]}
                      title="Guardar observación"
                      className="text-muted-foreground"
                    >
                      {busy[`task:${task.id}`] ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3" />
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="size-3 text-muted-foreground shrink-0" />
                    <textarea
                      value={taskObsDraft[task.id] ?? ""}
                      onChange={(e) => onTaskObsChange(task.id, e.target.value)}
                      rows={1}
                      placeholder="Observaciones de la tarea..."
                      className="flex-1 resize-y rounded-md border border-border bg-card px-2 py-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}