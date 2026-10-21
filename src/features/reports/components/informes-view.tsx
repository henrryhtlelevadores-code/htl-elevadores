"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  type CompletedWorkOrderReport,
  type ReportElevator,
  type ReportElevatorTask,
  type ReportPhoto,
  type ReportAudio,
  updateAudioTranscript,
  transcribeAudioNow,
  updateElevatorFinding,
  updateWorkOrderClosingNotes,
  updateTaskObservation,
  removeEvidencePhoto,
  updateClientSignature,
  completeManualReport,
  type ManualReportOrder,
  type EvidenceTag,
} from "../actions";
import { type ServiceTypeOption } from "@/features/work-orders/actions";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CalendarStatsIcon } from "@/components/ui/calendar-stats-icon";
import { EvidenceUploadDialog } from "./evidence-upload-dialog";
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Cpu,
  FileText,
  Loader2,
  MapPin,
  Mic,
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
  currentUser: { id: string; fullName: string | null };
  serviceTypes: ServiceTypeOption[];
  pendingOrders: ManualReportOrder[];
}

const MAX_EVIDENCE_PER_ELEVATOR = 10;

type ReportMonthRow = {
  id: string;
  otNumber: string;
  clientId: string;
  clientName: string;
  costCenterId: string;
  costCenterName: string;
  technicianName: string | null;
  status: string;
  completedAt: number | null;
  approvalStatus: string | null;
  missingReport: boolean;
  report: CompletedWorkOrderReport | null;
  pending: ManualReportOrder | null;
};

type ReportState = "APROBADO" | "BORRADOR" | "FALTA_INFORME";

type EvidenceTarget = {
  workOrderId: string;
  elevatorId: string;
  elevatorLabel: string;
  remaining: number;
  source: "report" | "manual";
};

function getReportState(row: ReportMonthRow): ReportState {
  if (row.missingReport) return "FALTA_INFORME";
  return row.approvalStatus === "APPROVED" ? "APROBADO" : "BORRADOR";
}

const REPORT_STATE_STYLES: Record<ReportState, string> = {
  APROBADO:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  BORRADOR:
    "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  FALTA_INFORME:
    "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
};

const REPORT_STATE_LABELS: Record<ReportState, string> = {
  APROBADO: "Aprobado",
  BORRADOR: "Borrador",
  FALTA_INFORME: "Falta Informe",
};

function ReportStateBadge({ state }: { state: ReportState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
        REPORT_STATE_STYLES[state]
      )}
    >
      {state === "FALTA_INFORME" && <AlertTriangle className="size-2.5" />}
      {REPORT_STATE_LABELS[state]}
    </span>
  );
}

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

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.round(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

/** Duración de una nota de voz: "0:42". */
function formatClipLength(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
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

function monthKeyOf(ts: number | null): string {
  if (!ts) return "";
  const date = new Date(ts);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isInMonth(
  dateIso: string | null | undefined,
  timestamp: number | null | undefined,
  monthPrefix: string
): boolean {
  if (dateIso) return dateIso.startsWith(monthPrefix);
  if (timestamp) return monthKeyOf(timestamp) === monthPrefix;
  return false;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Genera un sello "APROBADO POR EL RESPONSABLE" en PNG (data URL) para los informes
 * manuales: reemplaza la foto de la firma escaneada por una firma referencial
 * creada por computadora.
 */
function buildPorterStamp(name: string, timestamp?: number | null): string {
  const width = 640;
  const height = 240;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const ink = "#0f766e";
  const date = new Date(timestamp ?? Date.now()).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  // Ligera inclinación para que parezca un sello real.
  ctx.translate(width / 2, height / 2);
  ctx.rotate((-4 * Math.PI) / 180);
  ctx.translate(-width / 2, -height / 2);

  ctx.strokeStyle = ink;
  ctx.lineWidth = 6;
  roundedRect(ctx, 16, 16, width - 32, height - 32, 20);
  ctx.stroke();
  ctx.lineWidth = 2;
  roundedRect(ctx, 30, 30, width - 60, height - 60, 14);
  ctx.stroke();

  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 25px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("APROBADO POR EL RESPONSABLE", width / 2, 72);

  ctx.font = "italic 46px 'Segoe Script', 'Brush Script MT', cursive";
  ctx.fillText(name.trim() || "—", width / 2, 138, width - 100);

  ctx.font = "600 17px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(`Conformidad registrada el ${date}`, width / 2, 190);

  ctx.restore();
  return canvas.toDataURL("image/png");
}

/**
 * Sello automático para informes sin firma (incluye OTs antiguas): muestra
 * "APROBADO POR EL RESPONSABLE" con el nombre disponible y la fecha del informe.
 */
function AutoApprovalStamp({
  name,
  timestamp,
}: {
  name: string;
  timestamp?: number | null;
}) {
  const src = useMemo(() => buildPorterStamp(name, timestamp), [name, timestamp]);
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Aprobado por el responsable"
      className="h-16 w-40 object-contain bg-white border border-border rounded-lg"
    />
  );
}

/**
 * Muestra la firma guardada. Si no existe, está rota o es un sello antiguo
 * generado por el sistema (640×240), dibuja el sello vigente
 * "APROBADO POR EL RESPONSABLE" en lugar de la imagen obsoleta.
 */
function SignaturePreview({
  url,
  name,
  timestamp,
}: {
  url: string | null;
  name: string;
  timestamp?: number | null;
}) {
  const [useStamp, setUseStamp] = useState(false);
  if (!url || useStamp) {
    return <AutoApprovalStamp name={name} timestamp={timestamp} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Firma del cliente"
      className="h-16 w-40 object-contain bg-white border border-border rounded-lg"
      onLoad={(event) => {
        const image = event.currentTarget;
        if (image.naturalWidth === 640 && image.naturalHeight === 240) {
          setUseStamp(true);
        }
      }}
      onError={() => setUseStamp(true)}
    />
  );
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
  currentUser,
  pendingOrders,
  serviceTypes,
}: InformesViewProps) {
  const router = useRouter();
  const [data, setData] = useState<CompletedWorkOrderReport[]>(workOrders);
  const [clientFilter, setClientFilter] = useState("");
  const [ccFilter, setCcFilter] = useState("");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [viewingId, setViewingId] = useState<string | null>(null);

  const [notesDraft, setNotesDraft] = useState("");
  const [findingsDraft, setFindingsDraft] = useState<Record<string, string>>({});
  const [taskObsDraft, setTaskObsDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalDate, setApprovalDate] = useState<number | null>(null);
  const [approving, setApproving] = useState(false);
  const [signerDraft, setSignerDraft] = useState("");
  const [signatureDraft, setSignatureDraft] = useState("");
  const [savingSignature, setSavingSignature] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualStep, setManualStep] = useState(1);
  const [manualOrder, setManualOrder] = useState<ManualReportOrder | null>(null);
  const [manualClientId, setManualClientId] = useState("");
  const [manualCostCenterId, setManualCostCenterId] = useState("");
  const [manualServiceTypeId, setManualServiceTypeId] = useState("");
  const [manualSigner, setManualSigner] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualFindings, setManualFindings] = useState<Record<string, string>>({});
  const [manualStartTime, setManualStartTime] = useState("");
  const [manualEndTime, setManualEndTime] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualPhotos, setManualPhotos] = useState<Record<string, ReportPhoto[]>>({});
  const [evidenceTarget, setEvidenceTarget] = useState<EvidenceTarget | null>(null);

  function selectManualOrder(order: ManualReportOrder) {
    setManualOrder(order);
    setManualPhotos(
      Object.fromEntries(order.elevators.map((elevator) => [elevator.id, elevator.photos]))
    );
  }

  const manualCostCenters = useMemo(
    () => costCenters.filter((center) => center.clientId === manualClientId),
    [costCenters, manualClientId]
  );
  const manualPendingOrders = useMemo(
    () => {
      if (!manualClientId || !manualCostCenterId) return [];
      return pendingOrders.filter((order) =>
        order.clientId === manualClientId &&
        order.costCenterId === manualCostCenterId &&
        (!manualServiceTypeId || order.serviceTypeId === manualServiceTypeId)
      );
    },
    [pendingOrders, manualClientId, manualCostCenterId, manualServiceTypeId, serviceTypes]
  );

  async function saveManual() {
    if (!manualOrder) return;
    if (!manualSigner.trim()) {
      toast.error("Falta el nombre del responsable", { description: "Indica quién aprueba el informe." });
      return;
    }
    setManualSaving(true);
    // La firma ya no se adjunta como foto: se genera un sello referencial.
    const signatureDataUrl = buildPorterStamp(manualSigner);
    const result = await completeManualReport({ workOrderId: manualOrder.id, date: manualOrder.scheduledDate, startTime: manualStartTime, endTime: manualEndTime, number: "", notes: manualNotes, findings: manualFindings, signerName: manualSigner, signatureDataUrl });
    setManualSaving(false);
    if (!result.success) { toast.error("No se pudo guardar", { description: result.error }); return; }
    toast.success(result.message); setManualOpen(false); setManualStep(1); setManualOrder(null); router.refresh();
  }

  const filteredCostCenters = useMemo(
    () =>
      clientFilter
        ? costCenters.filter((cc) => cc.clientId === clientFilter)
        : costCenters,
    [clientFilter, costCenters]
  );

  const monthPrefix = useMemo(
    () =>
      `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`,
    [currentMonth]
  );

  const monthTitle = useMemo(
    () =>
      currentMonth.toLocaleDateString("es-PE", {
        month: "long",
        year: "numeric",
      }),
    [currentMonth]
  );

  const monthRows = useMemo<ReportMonthRow[]>(() => {
    const reports: ReportMonthRow[] = data
      .filter((wo) => isInMonth(wo.scheduledDate, wo.completedAt, monthPrefix))
      .map((wo) => ({
        id: wo.id,
        otNumber: wo.otNumber,
        clientId: wo.clientId ?? "",
        clientName: wo.client_name,
        costCenterId: wo.costCenterId ?? "",
        costCenterName: wo.cost_center_name,
        technicianName: wo.technician_name,
        status: wo.status ?? "COMPLETED",
        completedAt: wo.completedAt,
        approvalStatus: wo.approvalStatus,
        missingReport: false,
        report: wo,
        pending: null,
      }));

    const missing: ReportMonthRow[] = pendingOrders
      .filter((order) => isInMonth(order.scheduledDate, null, monthPrefix))
      .map((order) => ({
        id: order.id,
        otNumber: order.otNumber,
        clientId: order.clientId,
        clientName: order.clientName,
        costCenterId: order.costCenterId,
        costCenterName: order.costCenterName,
        technicianName: order.technicianName,
        status: "PENDING",
        completedAt: null,
        approvalStatus: null,
        missingReport: true,
        report: null,
        pending: order,
      }));

    return [...missing, ...reports].sort((a, b) => {
      if (a.missingReport !== b.missingReport) return a.missingReport ? -1 : 1;
      return (b.completedAt ?? 0) - (a.completedAt ?? 0);
    });
  }, [data, pendingOrders, monthPrefix]);

  const filteredRows = useMemo(
    () =>
      monthRows.filter(
        (row) =>
          (!clientFilter || row.clientId === clientFilter) &&
          (!ccFilter || row.costCenterId === ccFilter)
      ),
    [monthRows, clientFilter, ccFilter]
  );

  const missingReportCount = useMemo(
    () => filteredRows.filter((row) => row.missingReport).length,
    [filteredRows]
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
    setSignerDraft(wo.clientSignerName ?? "");
    setSignatureDraft("");
  }, []);

  function changeMonth(delta: number) {
    setCurrentMonth((date) => new Date(date.getFullYear(), date.getMonth() + delta, 1));
  }

  function goToCurrentMonth() {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  const handleReviewRow = useCallback(
    (row: ReportMonthRow) => {
      if (row.report) {
        handleOpen(row.report);
        return;
      }
      if (row.pending) {
        selectManualOrder(row.pending);
        setManualClientId(row.pending.clientId);
        setManualCostCenterId(row.pending.costCenterId);
        setManualServiceTypeId(row.pending.serviceTypeId ?? "");
        setManualSigner("");
        setManualNotes("");
        setManualFindings({});
        setManualStartTime("");
        setManualEndTime("");
        setManualStep(2);
        setManualOpen(true);
      }
    },
    [handleOpen]
  );

  async function handleSaveSignature() {
    if (!viewing) return;
    setSavingSignature(true);
    const result = await updateClientSignature({ workOrderId: viewing.id, signerName: signerDraft, signatureDataUrl: signatureDraft || undefined });
    setSavingSignature(false);
    if (!result.success) { toast.error("No se pudo actualizar", { description: result.error }); return; }
    patchWorkOrder(viewing.id, (wo) => ({ ...wo, clientSignerName: signerDraft.trim() || null, clientSignatureUrl: signatureDraft ? wo.clientSignatureUrl : wo.clientSignatureUrl }));
    toast.success(result.message);
    router.refresh();
  }

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

  function handleEvidenceUploaded(urls: string[], tag: EvidenceTag) {
    const target = evidenceTarget;
    if (!target) return;
    const uploaded: ReportPhoto[] = urls.map((url) => ({
      id: url,
      url,
      tag,
      description: null,
      createdAt: Date.now(),
    }));
    if (target.source === "report") {
      patchWorkOrder(target.workOrderId, (wo) => ({
        ...wo,
        elevators: wo.elevators.map((elevator) =>
          elevator.id === target.elevatorId
            ? {
                ...elevator,
                evidencePhotoUrls: [...elevator.evidencePhotoUrls, ...urls],
                photos: [...elevator.photos, ...uploaded],
              }
            : elevator
        ),
      }));
    } else {
      setManualPhotos((prev) => ({
        ...prev,
        [target.elevatorId]: [...(prev[target.elevatorId] ?? []), ...uploaded],
      }));
    }
    setEvidenceTarget(null);
  }

  function openReportEvidence(elevator: ReportElevator, workOrderId: string) {
    setEvidenceTarget({
      workOrderId,
      elevatorId: elevator.id,
      elevatorLabel:
        [elevator.internalCode, elevator.elevatorName].filter(Boolean).join(" · ") ||
        "Equipo",
      remaining: Math.max(0, MAX_EVIDENCE_PER_ELEVATOR - elevator.photos.length),
      source: "report",
    });
  }

  async function handleRemoveManualPhoto(elevatorId: string, url: string) {
    const previous = manualPhotos[elevatorId] ?? [];
    setManualPhotos((prev) => ({
      ...prev,
      [elevatorId]: (prev[elevatorId] ?? []).filter((photo) => photo.url !== url),
    }));
    const res = await removeEvidencePhoto(elevatorId, url);
    if (res.success) {
      toast.success(res.message);
    } else {
      setManualPhotos((prev) => ({ ...prev, [elevatorId]: previous }));
      toast.error("Error", { description: res.error });
    }
  }

  function renderEvidenceDialog(source: EvidenceTarget["source"]) {
    if (!evidenceTarget || evidenceTarget.source !== source) return null;
    return (
      <EvidenceUploadDialog
        open
        onOpenChange={(open) => {
          if (!open) setEvidenceTarget(null);
        }}
        workOrderId={evidenceTarget.workOrderId}
        elevatorId={evidenceTarget.elevatorId}
        elevatorLabel={evidenceTarget.elevatorLabel}
        remaining={evidenceTarget.remaining}
        onUploaded={handleEvidenceUploaded}
      />
    );
  }

  async function handleRemovePhoto(elevator: ReportElevator, url: string) {
    const previous = elevator.evidencePhotoUrls;
    const previousPhotos = elevator.photos;
    const optimistic = elevator.evidencePhotoUrls.filter((u) => u !== url);
    patchWorkOrder(elevator.workOrderId, (wo) => ({
      ...wo,
      elevators: wo.elevators.map((e) =>
        e.id === elevator.id
          ? {
              ...e,
              evidencePhotoUrls: optimistic,
              photos: e.photos.filter((photo) => photo.url !== url),
            }
          : e
      ),
    }));
    const res = await removeEvidencePhoto(elevator.id, url);
    if (res.success) {
      toast.success(res.message);
    } else {
      patchWorkOrder(elevator.workOrderId, (wo) => ({
        ...wo,
        elevators: wo.elevators.map((e) =>
          e.id === elevator.id
            ? { ...e, evidencePhotoUrls: previous, photos: previousPhotos }
            : e
        ),
      }));
      toast.error("Error", { description: res.error });
    }
  }

  async function handleApprove() {
    if (!viewing || viewing.approvalStatus === "APPROVED") return;
    setApproving(true);
    try {
      const response = await fetch(`/api/work-orders/${viewing.id}/approve`, {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo aprobar la OT.");
      toast.success("OT aprobada y publicada");
      setApprovalOpen(false);
      router.refresh();
      setData((previous) =>
        previous.map((wo) =>
          wo.id === viewing.id
            ? {
                ...wo,
                approvalStatus: "APPROVED",
                approvedBy: currentUser.id,
                approvedByName: currentUser.fullName,
                approvedAt: Date.now(),
              }
            : wo
        )
      );
    } catch (error) {
      toast.error("No se pudo aprobar", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
      });
    } finally {
      setApproving(false);
    }
  }

  const columns = useMemo<ColumnDef<ReportMonthRow>[]>(
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
          <div className="flex items-center gap-1.5">
            {row.original.missingReport && (
              <span
                className="size-1.5 shrink-0 rounded-full bg-orange-500"
                aria-hidden
              />
            )}
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border border-border">
              {row.getValue("otNumber")}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "clientName",
        header: "Cliente",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-xs text-foreground max-w-[180px]">
            <Building2 className="size-3.5 text-[#0066CC] shrink-0" />
            <span className="truncate font-semibold">{row.getValue("clientName")}</span>
          </div>
        ),
      },
      {
        accessorKey: "costCenterName",
        header: "Centro de Costo",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground max-w-[160px]">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{row.getValue("costCenterName")}</span>
          </div>
        ),
      },
      {
        accessorKey: "technicianName",
        header: "Técnico",
        cell: ({ row }) => {
          const name = row.getValue<string | null>("technicianName");
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
        id: "state",
        header: "Estado",
        cell: ({ row }) => <ReportStateBadge state={getReportState(row.original)} />,
      },
      {
        accessorKey: "completedAt",
        header: "Completada",
        cell: ({ row }) => (
          <span className="text-xs font-mono text-muted-foreground">
            {row.original.missingReport
              ? "—"
              : formatDate(row.getValue<number | null>("completedAt"))}
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
              onClick={() => handleReviewRow(row.original)}
              className={cn(
                "h-7 px-2.5 text-xs font-semibold gap-1.5 shadow-2xs",
                row.original.missingReport
                  ? "text-orange-600 dark:text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                  : "text-[#0066CC] dark:text-blue-400 border-[#0066CC]/30 hover:bg-[#0066CC]/10"
              )}
            >
              <PenLine className="size-3" />
              Revisar
            </Button>
          </div>
        ),
      },
    ],
    [handleReviewRow]
  );

  const totalPhotos = useMemo(
    () => viewing?.elevators.reduce((acc, e) => acc + e.photos.length, 0) ?? 0,
    [viewing]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-border bg-card shadow-xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeMonth(-1)}
              aria-label="Mes anterior"
              className="size-9 rounded-r-none"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <button
              type="button"
              onClick={goToCurrentMonth}
              title="Ir al mes actual"
              className="flex h-9 min-w-[164px] items-center justify-center gap-2 border-x border-border px-3 text-sm font-semibold capitalize transition-colors hover:bg-muted/50"
            >
              <CalendarDays className="size-4 text-[#0066CC]" />
              <span className="capitalize">{monthTitle}</span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changeMonth(1)}
              aria-label="Mes siguiente"
              className="size-9 rounded-l-none"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">
            {filteredRows.length} OT{filteredRows.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {missingReportCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-500" />
          <p className="text-xs text-orange-700 dark:text-orange-300">
            <span className="font-semibold">
              {missingReportCount} OT{missingReportCount === 1 ? "" : "s"} sin informe
            </span>{" "}
            este mes. Usa “Revisar” en las filas resaltadas para completar el
            informe manual.
          </p>
        </div>
      )}

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
            className="h-8 sm:w-[220px]"
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
            className="h-8 sm:w-[220px]"
          />

          {(clientFilter || ccFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setClientFilter("");
                setCcFilter("");
              }}
              className="h-8 gap-1 px-2 text-xs text-muted-foreground"
            >
              <X className="size-3" />
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        searchPlaceholder="Buscar por OT, cliente o técnico..."
        rowClassName={(row) =>
          row.original.missingReport
            ? "bg-orange-500/[0.04] hover:bg-orange-500/[0.08]"
            : undefined
        }
        mobileCard={(row) => {
          const item = row.original;
          const state = getReportState(item);
          return (
            <article
              className={cn(
                "min-w-0 overflow-hidden rounded-xl border bg-card p-4 shadow-xs",
                item.missingReport ? "border-orange-500/40" : "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-block rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold border border-border">
                    {item.otNumber}
                  </span>
                  <h3 className="mt-2 truncate text-sm font-semibold">
                    {item.clientName || "—"}
                  </h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.costCenterName || "—"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <ReportStateBadge state={state} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReviewRow(item)}
                    className={cn(
                      "h-9 min-w-11 gap-1.5 px-3 text-xs",
                      item.missingReport
                        ? "text-orange-600 dark:text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
                        : "text-[#0066CC] border-[#0066CC]/30 hover:bg-[#0066CC]/10"
                    )}
                  >
                    <PenLine className="size-3.5" />
                    Revisar
                  </Button>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div>
                  <dt className="text-muted-foreground">Técnico</dt>
                  <dd className="truncate font-medium">
                    {item.technicianName ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Completada</dt>
                  <dd className="font-medium">
                    {item.missingReport ? "—" : formatDate(item.completedAt)}
                  </dd>
                </div>
              </dl>
            </article>
          );
        }}
      />

      {/* Modal: Revisar Informe (OT completada) */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewingId(null)}>
        <DialogContent
          showCloseButton={false}
          className="bg-card border-border sm:max-w-[820px] text-foreground shadow-lg max-h-[92dvh] overflow-y-auto"
        >
          {viewing && (
            <>
              <DialogHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  {/* Fila 1 (móvil): título + botón cerrar */}
                  <div className="flex items-center justify-between w-full gap-2 md:w-auto">
                    <DialogTitle className="flex min-w-0 items-center gap-2 text-base font-bold">
                      <ClipboardList className="size-4 shrink-0 text-[#0066CC]" />
                      <span className="truncate">{viewing.otNumber}</span>
                    </DialogTitle>
                    <button
                      onClick={() => setViewingId(null)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground md:hidden"
                    >
                      <ChevronLeft className="size-3" />
                      Cerrar
                    </button>
                  </div>

                  {/* Fila 2 (móvil): badges de estado */}
                  <div className="flex flex-wrap items-center gap-2 mt-1 md:mt-0">
                    {viewing.approvalStatus === "APPROVED" ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        Aprobado
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        Borrador
                      </span>
                    )}
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                      Completada
                    </span>
                    {viewing.approvalStatus === "PENDING" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setApprovalDate(Date.now());
                          setApprovalOpen(true);
                        }}
                      >
                        Aprobar y publicar
                      </Button>
                    )}
                    <button
                      onClick={() => setViewingId(null)}
                      className="hidden items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground md:inline-flex"
                    >
                      <ChevronLeft className="size-3" />
                      Cerrar
                    </button>
                  </div>
                </div>
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
                {viewing.startedAt && viewing.completedAt && (
                  <InfoChip
                    label="Duración"
                    value={`${formatDuration(viewing.completedAt - viewing.startedAt)} (${formatTime(viewing.startedAt)} – ${formatTime(viewing.completedAt)})`}
                  />
                )}
              </div>

              {/* Firma del cliente */}
              {(
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex flex-wrap items-center gap-4">
                  {viewing.clientSignatureUrl ? (
                    <SignaturePreview
                      key={viewing.clientSignatureUrl}
                      url={viewing.clientSignatureUrl}
                      name={
                        viewing.clientSignerName?.trim() ||
                        viewing.approvedByName?.trim() ||
                        "Responsable"
                      }
                      timestamp={viewing.approvedAt ?? viewing.completedAt}
                    />
                  ) : (
                    <AutoApprovalStamp
                      name={
                        viewing.clientSignerName?.trim() ||
                        viewing.approvedByName?.trim() ||
                        "Responsable"
                      }
                      timestamp={viewing.approvedAt ?? viewing.completedAt}
                    />
                  )}
                  <div className="min-w-[220px] flex-1 space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Firma del cliente
                    </div>
                    <Input value={signerDraft} onChange={(event) => setSignerDraft(event.target.value)} placeholder="Nombre del cliente" className="h-8 text-xs" />
                    <Input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setSignatureDraft(String(reader.result)); reader.readAsDataURL(file); }} className="h-8 text-xs" />
                    <Button size="xs" variant="outline" onClick={handleSaveSignature} disabled={savingSignature || !signerDraft.trim()}>{savingSignature ? "Guardando..." : "Actualizar firma"}</Button>
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
                  disabled={busy["notes"]}
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
                      onPhotoTarget={() => openReportEvidence(elevator, viewing.id)}
                      onSaveFinding={() => handleSaveFinding(elevator)}
                      onRemovePhoto={(url) => handleRemovePhoto(elevator, url)}
                      onSaveTask={(task) =>
                        handleSaveTaskObservation(task, elevator)
                      }
                      readOnly={false}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
        <DialogContent className="bg-card text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aprobar y publicar</DialogTitle>
            <DialogDescription>
              La OT se marcará como aprobada y será visible inmediatamente en el portal del cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <p><strong>Aprobada por:</strong> {currentUser.fullName ?? currentUser.id}</p>
            <p><strong>Fecha:</strong> {formatDate(approvalDate)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalOpen(false)} disabled={approving}>
              Cancelar
            </Button>
            <Button onClick={handleApprove} disabled={approving}>
              {approving && <Loader2 className="size-4 animate-spin" />}
              Aprobar
            </Button>
          </DialogFooter>
        </DialogContent>
        {renderEvidenceDialog("report")}
      </Dialog>

       <Dialog open={manualOpen} onOpenChange={setManualOpen}>
         {manualStep === 1 ? <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl sm:max-w-2xl min-w-0 bg-card text-foreground sm:w-full">
           <DialogHeader><DialogTitle>Informe Manual</DialogTitle><DialogDescription className="sr-only">Selecciona la OT que deseas completar manualmente</DialogDescription></DialogHeader>
           <div className="space-y-4 py-2"><div className="grid min-w-0 gap-3 sm:grid-cols-2"><SearchableSelect className="w-full min-w-0" items={clients} value={manualClientId} onValueChange={(value) => { setManualClientId(value); setManualCostCenterId(""); setManualServiceTypeId(""); setManualOrder(null); }} getValue={(client) => client.id} getLabel={(client) => client.legalName} placeholder="Cliente *" searchPlaceholder="Buscar cliente..." emptyText="No hay clientes" /><SearchableSelect className="w-full min-w-0" items={manualCostCenters} value={manualCostCenterId} onValueChange={(value) => { setManualCostCenterId(value); setManualServiceTypeId(""); setManualOrder(null); }} getValue={(center) => center.id} getLabel={(center) => center.name} getKeywords={(center) => center.client_name} placeholder="Centro de costos *" searchPlaceholder="Buscar centro..." emptyText="Selecciona un cliente primero" disabled={!manualClientId} /></div><SearchableSelect className="w-full min-w-0" items={serviceTypes} value={manualServiceTypeId} onValueChange={(value) => { setManualServiceTypeId(value); setManualOrder(null); }} getValue={(type) => type.id} getLabel={(type) => type.name} placeholder="Tipo de servicio (Todos)" searchPlaceholder="Buscar servicio..." emptyText="No hay tipos de servicio" disabled={!manualCostCenterId} /><div className="border-t pt-4"><p className="mb-3 text-sm font-medium">OTs pendientes ({manualPendingOrders.length})</p>{!manualClientId || !manualCostCenterId ? <p className="text-sm text-muted-foreground">Selecciona un cliente y un centro de costos para consultar las OTs pendientes.</p> : manualPendingOrders.length === 0 ? <p className="text-sm text-muted-foreground">No hay OTs pendientes para esta selección.</p> : <div className="space-y-2">{manualPendingOrders.map((o) => <label key={o.id} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors", manualOrder?.id === o.id ? "border-primary bg-primary/5" : "hover:bg-muted/50")}><input type="radio" name="manual-order" checked={manualOrder?.id === o.id} onChange={() => selectManualOrder(o)} className="mt-1" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><span className="font-mono text-sm font-semibold">{o.otNumber}</span><span className="shrink-0 text-xs text-muted-foreground">{formatDayTime(o.scheduledDate, o.scheduledTime)}</span></div><p className="mt-1 text-xs text-muted-foreground">🔧 {o.elevators.length} equipo(s): {o.elevators.map((e) => e.internalCode).filter(Boolean).join(", ")}</p><p className="mt-0.5 text-xs text-muted-foreground">{o.serviceTypeName ?? "Sin tipo de servicio"}</p></div></label>)}</div>}</div></div>
           <DialogFooter><Button variant="ghost" onClick={() => setManualOpen(false)}>Cancelar</Button><Button disabled={!manualOrder} onClick={() => setManualStep(2)}>Continuar</Button></DialogFooter>
         </DialogContent> : <DialogContent showCloseButton={false} className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-3xl sm:max-w-3xl min-w-0 flex-col gap-0 overflow-hidden bg-card p-0 text-foreground max-sm:m-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-screen max-sm:max-w-none max-sm:rounded-none">
           <header className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">Informe Manual · Paso 2 de 2</p><p className="truncate font-mono text-sm font-semibold">{manualOrder?.otNumber}</p></div><Button variant="ghost" size="icon" onClick={() => setManualOpen(false)}><X className="size-4" /></Button></header>
           <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="space-y-6 px-4 py-4"><div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="flex items-center gap-1.5 font-medium"><CalendarStatsIcon className="size-3.5 text-[#0066CC]" />{manualOrder && formatDayTime(manualOrder.scheduledDate, manualOrder.scheduledTime)}</p><p className="mt-1 text-xs text-muted-foreground">{manualOrder?.serviceTypeName}</p></div><section><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Horario real</h3><div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Inicio *<TimePicker value={manualStartTime} onChange={setManualStartTime} /></label><label className="text-xs font-semibold">Fin *<TimePicker value={manualEndTime} onChange={setManualEndTime} /></label></div><p className="mt-2 text-[11px] text-muted-foreground">Se guardará usando la hora oficial de Perú (UTC-05:00).</p></section><section><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Equipos ({manualOrder?.elevators.length ?? 0})</h3><div className="space-y-3">{manualOrder?.elevators.map((elevator) => <div key={elevator.id} className="rounded-lg border bg-card p-3"><div className="flex items-center gap-2"><span className="rounded border px-2 py-0.5 font-mono text-xs">{elevator.internalCode}</span><span className="truncate text-sm font-medium">{elevator.name}</span></div><div className="mt-3 flex items-center justify-between border-t pt-3 text-xs"><span>Safety</span><span className="text-muted-foreground">Se completará al guardar</span></div><div className="mt-3 flex items-center justify-between border-t pt-3 text-xs"><span>Tareas</span><span className="text-muted-foreground">Se completarán al guardar</span></div><Textarea className="mt-3" placeholder="Hallazgos propios de este equipo..." rows={3} value={manualFindings[elevator.id] ?? ""} onChange={(event) => setManualFindings((current) => ({ ...current, [elevator.id]: event.target.value }))} /><ManualElevatorEvidence photos={manualPhotos[elevator.id] ?? elevator.photos} onAdd={() => { if (!manualOrder) return; setEvidenceTarget({ workOrderId: manualOrder.id, elevatorId: elevator.id, elevatorLabel: [elevator.internalCode, elevator.name].filter(Boolean).join(" · ") || "Equipo", remaining: Math.max(0, MAX_EVIDENCE_PER_ELEVATOR - (manualPhotos[elevator.id]?.length ?? elevator.photos.length)), source: "manual" }); }} onRemove={(url) => void handleRemoveManualPhoto(elevator.id, url)} /></div>)}</div></section><section><h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cierre</h3><div className="space-y-3"><Textarea placeholder="Observaciones generales" rows={3} value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} /><Input placeholder="Nombre del responsable *" value={manualSigner} onChange={(e) => setManualSigner(e.target.value)} /><div className="rounded-lg border border-dashed p-3"><span className="text-xs font-semibold text-foreground">Firma referencial (automática)</span><div className="mt-2 rounded-md border-2 border-teal-700/60 px-3 py-2 text-center text-teal-700"><div className="text-[10px] font-bold uppercase tracking-widest">Aprobado por el responsable</div><div className="py-0.5 text-xl italic leading-tight" style={{ fontFamily: "'Segoe Script', 'Brush Script MT', cursive" }}>{manualSigner.trim() || "Nombre del responsable"}</div><div className="text-[9px] uppercase tracking-wide">Sello generado por computadora</div></div></div></div></section></div></div>
           <footer className="flex shrink-0 items-center justify-between gap-2 border-t bg-background px-4 py-3"><Button variant="ghost" onClick={() => setManualStep(1)}>Volver</Button><Button disabled={manualSaving || !manualSigner.trim() || !manualStartTime || !manualEndTime} onClick={saveManual}>{manualSaving ? <Loader2 className="animate-spin" /> : "Guardar y aprobar"}</Button></footer>
          </DialogContent>}
          {renderEvidenceDialog("manual")}
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
  readOnly = false,
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
  readOnly?: boolean;
}) {
  const completedTasks = elevator.tasks.filter((t) => t.isCompleted).length;
  const hasModules = elevator.tasks.some((task) => task.moduleId !== null);
  const moduleGroups = Array.from(
    elevator.tasks.reduce((groups, task) => {
      const key = task.moduleId ?? "__without-module__";
      const group = groups.get(key) ?? [];
      group.push(task);
      groups.set(key, group);
      return groups;
    }, new Map<string, ReportElevatorTask[]>())
  );
  const finalStatusLabel =
    elevator.finalStatus === "OUT_OF_SERVICE"
      ? "Fuera de servicio"
      : elevator.finalStatus === "OPERATIVE"
        ? "Operativo"
        : "—";

  function renderTask(task: ReportElevatorTask) {
    return (
      <div
        key={task.id}
        className="rounded-lg border border-border bg-muted/20 px-2.5 py-2 space-y-1.5"
      >
        <div className="flex items-center gap-2">
          {task.isCompleted ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
          ) : (
            <Circle className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className={cn("text-xs flex-1", task.isCompleted && "line-through text-muted-foreground/60")}>
            {task.taskDescription}
            {task.isCritical && (
              <span className="ml-1.5 rounded border border-red-500/30 bg-red-500/10 px-1 py-0.5 text-[9px] font-bold uppercase text-red-500">
                Crítica
              </span>
            )}
          </span>
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onSaveTask(task)}
              disabled={busy[`task:${task.id}`]}
              title="Guardar observación"
              className="text-muted-foreground"
            >
              {busy[`task:${task.id}`] ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <FileText className="size-3 shrink-0 text-muted-foreground" />
          {readOnly ? (
            <p className="flex-1 text-xs text-muted-foreground">{task.observations || "Sin observaciones."}</p>
          ) : (
            <textarea
              value={taskObsDraft[task.id] ?? ""}
              onChange={(e) => onTaskObsChange(task.id, e.target.value)}
              rows={1}
              placeholder="Observaciones de la tarea..."
              className="flex-1 resize-y rounded-md border border-border bg-card px-2 py-1 text-xs outline-none focus-visible:ring-1 focus-visible:ring-[#0066CC]"
            />
          )}
        </div>
      </div>
    );
  }

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
               disabled={readOnly || busy[`finding:${elevator.id}`]}
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
            id={`finding-${elevator.id}`}
            rows={2}
             value={finding}
             onChange={(e) => onFindingChange(e.target.value)}
             disabled={readOnly}
            placeholder="Hallazgos de la intervención..."
            className="bg-card border-border text-xs leading-relaxed focus-visible:ring-1 focus-visible:ring-[#0066CC]"
          />
        </div>

        {/* Evidencias */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Camera className="size-3.5" />
              Evidencias ({elevator.photos.length})
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => onPhotoTarget(elevator.id)}
              disabled={readOnly || busy[`upload:${elevator.id}`]}
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
          {elevator.photos.length === 0 ? (
            <p className="text-xs text-muted-foreground/60 italic py-1">
              Sin evidencias fotográficas.
            </p>
          ) : (
            <div className="space-y-3">
              {(["BEFORE", "AFTER", "POINT"] as const).map((tag) => {
                const items = elevator.photos.filter((photo) => photo.tag === tag);
                if (items.length === 0) return null;
                return (
                  <PhotoSection
                    key={tag}
                    title={{ BEFORE: "Antes", AFTER: "Después", POINT: "Puntuales" }[tag]}
                    photos={items}
                    readOnly={readOnly}
                    onRemovePhoto={onRemovePhoto}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Notas de voz grabadas desde la app */}
        {elevator.audios.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Mic className="size-3.5" />
              Notas de voz ({elevator.audios.length})
            </div>
            <p className="text-[11px] text-muted-foreground">
              Solo para revisión interna: el cliente no ve los audios ni las transcripciones, solo el texto de
              Hallazgos aprobado.
            </p>
            <div className="space-y-2">
              {elevator.audios.map((audio, index) => (
                <AudioNoteEditor
                  key={audio.id}
                  audio={audio}
                  index={index}
                  origin={audioOrigin(audio, elevator.photos)}
                  readOnly={readOnly}
                  onUseInFindings={(text) => {
                    const current = finding.trim();
                    if (current.includes(text)) {
                      toast.info("Ese texto ya está en Hallazgos");
                    } else {
                      onFindingChange(current ? `${current}\n${text}` : text);
                      toast.success("Agregado a Hallazgos", {
                        description: "Revisa el texto en Hallazgos (arriba) y pulsa Guardar.",
                      });
                    }
                    // El campo de Hallazgos queda arriba, fuera de la vista: se lleva ahí.
                    const field = document.getElementById(`finding-${elevator.id}`);
                    field?.scrollIntoView({ behavior: "smooth", block: "center" });
                    field?.focus({ preventScroll: true });
                  }}
                />
              ))}
            </div>
          </div>
        )}

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
            hasModules ? (
              <div className="space-y-2">
                {moduleGroups.map(([moduleId, moduleTasks]) => (
                  <details key={moduleId} open className="rounded-lg border border-border">
                    <summary className="cursor-pointer list-none px-3 py-2 text-xs font-bold">
                      {moduleTasks[0]?.moduleCode ?? "Sin módulo"} · {moduleTasks[0]?.moduleName ?? "Tareas generales"} ({moduleTasks.length} tareas)
                    </summary>
                    <div className="space-y-1 border-t border-border p-2">
                      {moduleTasks.map(renderTask)}
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <div className="space-y-1">{elevator.tasks.map(renderTask)}</div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Nota de voz en la revisión del informe: se escucha, se corrige o escribe
 * su transcripción y se puede pasar a Hallazgos, que es lo único que llega
 * al cliente.
 */
const PHOTO_TAG_LABEL: Record<string, string> = { BEFORE: "Antes", AFTER: "Después", POINT: "Puntual" };

type AudioOrigin = { label: string; photo: ReportPhoto | null };

/** De dónde viene la nota: de Hallazgos o de una foto ("Foto Después 2"). */
function audioOrigin(audio: ReportAudio, photos: ReportPhoto[]): AudioOrigin {
  const photo = audio.photoId ? photos.find((p) => p.id === audio.photoId) : undefined;
  if (!photo) return { label: "Grabada en Hallazgos", photo: null };
  const sameTag = photos.filter((p) => p.tag === photo.tag);
  const n = sameTag.findIndex((p) => p.id === photo.id) + 1;
  return { label: `De la foto ${PHOTO_TAG_LABEL[photo.tag] ?? ""} ${n}`.replace(/\s+/g, " "), photo };
}

function AudioNoteEditor({
  audio,
  index,
  origin,
  readOnly,
  onUseInFindings,
}: {
  audio: ReportAudio;
  index: number;
  origin: AudioOrigin;
  readOnly: boolean;
  onUseInFindings: (text: string) => void;
}) {
  const [draft, setDraft] = useState(audio.transcript ?? "");
  const [saved, setSaved] = useState(audio.transcript ?? "");
  const [saving, setSaving] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [status, setStatus] = useState(audio.transcriptStatus);
  const dirty = draft.trim() !== saved.trim();

  async function transcribe() {
    setTranscribing(true);
    setStatus("PENDING");
    const res = await transcribeAudioNow(audio.id);
    setTranscribing(false);
    if (res.success) {
      setStatus("DONE");
      setDraft(res.transcript ?? "");
      setSaved(res.transcript ?? "");
      toast.success(res.transcript ? "Transcripción lista" : "No se detectó voz en la nota");
    } else {
      setStatus("FAILED");
      toast.error("No se pudo transcribir", { description: res.error });
    }
  }

  async function save() {
    setSaving(true);
    const res = await updateAudioTranscript(audio.id, draft);
    setSaving(false);
    if (res.success) {
      setSaved(draft.trim());
      toast.success("Transcripción guardada");
    } else {
      toast.error("No se pudo guardar", { description: res.error });
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-2.5">
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2">
          {origin.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={origin.photo.url}
              alt=""
              className="size-8 shrink-0 rounded border border-border object-cover"
            />
          )}
          <span className="min-w-0">
            <span className="font-semibold text-foreground">Nota {index + 1}</span>
            <span className="block truncate">{origin.label}</span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          {status === "PENDING" && (
            <span className="inline-flex items-center gap-1 text-[#0066CC] dark:text-blue-400">
              <Loader2 className="size-3 animate-spin" />
              Transcribiendo…
            </span>
          )}
          {status === "FAILED" && <span className="text-red-600 dark:text-red-400">No se pudo transcribir</span>}
          {formatClipLength(audio.durationMs)}
        </span>
      </div>
      {audio.url ? (
        <audio controls preload="none" src={audio.url} className="h-9 w-full" />
      ) : (
        <p className="text-xs italic text-muted-foreground">No se pudo cargar el audio.</p>
      )}
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={readOnly}
        rows={2}
        maxLength={4000}
        placeholder={readOnly ? "Sin transcripción." : "Escribe o corrige la transcripción de esta nota…"}
        className="bg-card border-border text-xs leading-relaxed focus-visible:ring-1 focus-visible:ring-[#0066CC]"
      />
      {!readOnly && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={transcribing}
            onClick={transcribe}
            className="mr-auto text-xs text-[#0066CC] dark:text-blue-400"
            title="Transcribe la nota con Whisper; reemplaza el texto actual"
          >
            {transcribing ? <Loader2 className="size-3 animate-spin" /> : <Mic className="size-3" />}
            {saved ? "Volver a transcribir" : "Transcribir"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={!draft.trim()}
            onClick={() => onUseInFindings(draft.trim())}
            className="text-xs"
          >
            Agregar a Hallazgos
          </Button>
          <Button
            type="button"
            size="xs"
            disabled={!dirty || saving}
            onClick={save}
            className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white"
          >
            {saving && <Loader2 className="size-3 animate-spin" />}
            Guardar transcripción
          </Button>
        </div>
      )}
    </div>
  );
}

function ManualElevatorEvidence({
  photos,
  onAdd,
  onRemove,
}: {
  photos: ReportPhoto[];
  onAdd: () => void;
  onRemove: (url: string) => void;
}) {
  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Camera className="size-3.5" />
          Evidencias ({photos.length})
        </span>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={onAdd}
          disabled={photos.length >= MAX_EVIDENCE_PER_ELEVATOR}
          className="gap-1.5 text-xs font-semibold"
        >
          <Camera className="size-3" />
          Agregar fotos
        </Button>
      </div>
      {photos.length === 0 ? (
        <p className="py-1 text-xs italic text-muted-foreground/60">
          Adjunta fotos Antes, Después o Puntuales.
        </p>
      ) : (
        <div className="mt-2 space-y-3">
          {(["BEFORE", "AFTER", "POINT"] as const).map((tag) => {
            const items = photos.filter((photo) => photo.tag === tag);
            if (items.length === 0) return null;
            return (
              <PhotoSection
                key={tag}
                title={{ BEFORE: "Antes", AFTER: "Después", POINT: "Puntuales" }[tag]}
                photos={items}
                readOnly={false}
                onRemovePhoto={onRemove}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PhotoSection({
  title,
  photos,
  readOnly,
  onRemovePhoto,
}: {
  title: string;
  photos: ReportPhoto[];
  readOnly: boolean;
  onRemovePhoto: (url: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {title} ({photos.length})
      </h4>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <div key={photo.id} className="group relative min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.description ?? `${title} ${index + 1}`}
              className="aspect-square w-full rounded-lg border border-border object-cover"
            />
            {/* Comentario que el técnico escribió al tomar la foto. */}
            {photo.description && (
              <p
                className="mt-1 line-clamp-3 break-words text-[11px] leading-snug text-muted-foreground"
                title={photo.description}
              >
                {photo.description}
              </p>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => onRemovePhoto(photo.url)}
                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                title="Quitar foto"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
