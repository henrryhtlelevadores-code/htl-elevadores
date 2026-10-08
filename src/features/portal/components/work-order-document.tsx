"use client";

import * as React from "react";
import Link from "next/link";
import type {
  PortalWorkOrderDocument,
  PortalDocumentElevator,
  PortalDocumentTask,
} from "../queries";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Circle,
  Cpu,
} from "lucide-react";

interface WorkOrderDocumentProps {
  data: PortalWorkOrderDocument;
  costCenterId: string;
  generatedAt: string;
}

const PRIORITY_LABELS: Record<string, string> = {
  HIGH: "Alta",
  NORMAL: "Normal",
  LOW: "Baja",
};

const LEGACY_TYPE_LABELS: Record<string, string> = {
  CORRECTIVE: "Mantenimiento Correctivo",
  PREVENTIVE: "Mantenimiento Preventivo",
  PREDICTIVE: "Mantenimiento Predictivo",
  INSTALLATION: "Instalación",
};

function formatDate(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

function fieldLabel(label: string, value: React.ReactNode) {
  return (
    <div className="break-inside-avoid">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
        {label}
      </div>
      <div className="text-sm font-medium text-slate-800">{value}</div>
    </div>
  );
}

export function WorkOrderDocument({
  data,
  costCenterId,
  generatedAt,
}: WorkOrderDocumentProps) {
  const priority =
    PRIORITY_LABELS[data.priority ?? ""] ?? data.priority ?? "—";
  const serviceType =
    data.serviceTypeName ?? LEGACY_TYPE_LABELS[data.type ?? ""] ?? "—";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Barra de acciones (no se imprime) */}
      <div className="print:hidden sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link
            href={`/portal/${costCenterId}`}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al portal
          </Link>
        </div>
      </div>

      {/* Documento */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        {/* Membrete */}
        <div className="flex items-center justify-between gap-4 pb-6 border-b-4 border-[#021133]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#021133] text-white flex items-center justify-center font-extrabold text-xl">
              H
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight leading-none">
                HTL ELEVADORES
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Servicio Técnico Integral de Transporte Vertical
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Documento
            </p>
            <p className="text-sm font-bold text-[#021133]">
              Informe de Orden de Trabajo
            </p>
            <p className="text-xs text-slate-500">{generatedAt}</p>
          </div>
        </div>

        {/* Título del informe */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <p className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {data.otNumber}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Informe del servicio técnico realizado.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            SERVICIO COMPLETADO
          </span>
        </div>

        {/* Datos generales */}
        <section className="mt-6">
          <h4 className="text-sm font-bold uppercase tracking-wider text-[#021133] border-b border-slate-200 pb-2 mb-4">
            Información de la Orden de Trabajo
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            {fieldLabel("Edificio / Centro de costo", data.costCenterName ?? "—")}
            {fieldLabel(
              "Dirección",
              [data.costCenterAddress, data.costCenterDistrict]
                .filter(Boolean)
                .join(", ") || "—"
            )}
            {fieldLabel("Tipo de servicio", serviceType ?? "—")}
            {fieldLabel("Prioridad", priority)}
            {fieldLabel(
              "Técnico asignado",
              data.technicianName ?? "No registrado"
            )}
            {fieldLabel(
              "Programada",
              formatDayTime(data.scheduledDate, data.scheduledTime)
            )}
            {fieldLabel("Inicio del servicio", formatDateTime(data.startedAt))}
            {fieldLabel("Fecha de finalización", formatDateTime(data.completedAt))}
          </div>
        </section>

        {/* Equipos atendidos */}
        <section className="mt-8">
          <h4 className="text-sm font-bold uppercase tracking-wider text-[#021133] border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Equipos atendidos ({data.elevators.length})
          </h4>
          {data.elevators.length === 0 ? (
            <p className="text-sm text-slate-500">
              No se registraron equipos para esta orden.
            </p>
          ) : (
            <div className="space-y-5">
              {data.elevators.map((elevator) => (
                <ElevatorDocumentSection
                  key={elevator.id}
                  elevator={elevator}
                />
              ))}
            </div>
          )}
        </section>

        {/* Notas de cierre y firma */}
        <section className="mt-8 break-inside-avoid">
          <h4 className="text-sm font-bold uppercase tracking-wider text-[#021133] border-b border-slate-200 pb-2 mb-4">
            Resultado del servicio
          </h4>
          <div className="rounded-lg border border-slate-200 p-4 min-h-20">
            {data.closingNotes ? (
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {data.closingNotes}
              </p>
            ) : (
              <p className="text-sm text-slate-400 italic">
                Sin notas de cierre registradas.
              </p>
            )}
          </div>

          {(data.clientSignatureUrl || data.clientSignerName) && (
            <div className="mt-8 flex flex-wrap items-end gap-8">
              {data.clientSignatureUrl && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Firma del cliente
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.clientSignatureUrl}
                    alt="Firma del cliente"
                    className="h-20 w-56 object-contain bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              )}
              {data.clientSignerName && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Nombre de quien firma
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    {data.clientSignerName}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Pie de página */}
        <div className="mt-12 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <p className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            {data.costCenterName ?? "Centro de costo"} · {data.otNumber}
          </p>
          <p>
            Generado por HTL Elevadores el {generatedAt} · Documento
            informativo emitido por el portal del cliente.
          </p>
        </div>
      </div>
    </div>
  );
}

function ElevatorDocumentSection({
  elevator,
}: {
  elevator: PortalDocumentElevator;
}) {
  const completed = elevator.tasks.filter((t) => t.isCompleted).length;
  const hasModules = elevator.tasks.some((task) => task.moduleId !== null);
  const taskGroups = Array.from(
    elevator.tasks.reduce((groups, task) => {
      const key = task.moduleId ?? "__without-module__";
      const group = groups.get(key) ?? [];
      group.push(task);
      groups.set(key, group);
      return groups;
    }, new Map<string, PortalDocumentTask[]>())
  );
  const finalStatus =
    elevator.finalStatus === "OUT_OF_SERVICE"
      ? "Fuera de servicio"
      : elevator.finalStatus === "OPERATIVE"
        ? "Operativo"
        : "—";

  return (
    <div className="break-inside-avoid rounded-xl border border-slate-200 overflow-hidden">
      {/* Encabezado del equipo */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-white border border-slate-200">
          {elevator.internalCode || "—"}
        </span>
        <span className="text-sm font-semibold text-slate-900 truncate">
          {elevator.elevatorName || "Equipo"}
        </span>
        <span className="text-xs text-slate-500 truncate hidden sm:inline">
          {[elevator.brandName, elevator.modelName, elevator.elevatorTypeName]
            .filter(Boolean)
            .join(" • ") || "—"}
        </span>
        <span
          className={`inline-flex items-center gap-1 ml-auto text-xs font-semibold rounded-full px-2.5 py-1 ${
            elevator.finalStatus === "OUT_OF_SERVICE"
              ? "bg-red-50 text-red-600 border border-red-100"
              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
          }`}
        >
          {elevator.finalStatus === "OUT_OF_SERVICE" ? (
            <Circle className="w-3.5 h-3.5" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          Estado final: {finalStatus}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Hallazgos */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Hallazgos y observaciones del equipo
          </div>
          {elevator.finding ? (
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              {elevator.finding}
            </p>
          ) : (
            <p className="text-sm text-slate-400 italic">
              Sin hallazgos registrados.
            </p>
          )}
        </div>

        {/* Checklist */}
        {elevator.tasks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Checklist de tareas ejecutadas
              </div>
              <div className="text-xs text-slate-500">
                {completed}/{elevator.tasks.length} completadas
              </div>
            </div>
            {hasModules ? (
              <div className="space-y-2">
                {taskGroups.map(([moduleId, moduleTasks]) => (
                  <details key={moduleId} open className="rounded-lg border border-slate-200">
                    <summary className="cursor-pointer list-none px-3 py-2 text-xs font-bold text-slate-700">
                      {moduleTasks[0]?.moduleCode ?? "Sin módulo"} · {moduleTasks[0]?.moduleName ?? "Tareas generales"} ({moduleTasks.length} tareas)
                    </summary>
                    <div className="divide-y divide-slate-100 border-t border-slate-200">
                      {moduleTasks.map((task) => <TaskRow key={task.id} task={task} />)}
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {elevator.tasks.map((task) => <TaskRow key={task.id} task={task} />)}
              </div>
            )}
          </div>
        )}

        {/* Evidencias */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
             Evidencia fotográfica ({elevator.photos.length})
          </div>
           {elevator.photos.length === 0 ? (
            <p className="text-sm text-slate-400 italic">
              Sin evidencias fotográficas registradas.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {(["BEFORE", "AFTER", "POINT"] as const).map((tag) => {
                const photos = elevator.photos.filter((photo) => photo.tag === tag);
                if (photos.length === 0) return null;
                return (
                  <div key={tag} className="col-span-full space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {{ BEFORE: "Antes", AFTER: "Después", POINT: "Puntuales" }[tag]}
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {photos.map((photo, idx) => (
                        <div key={photo.id} className="space-y-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.url} alt={`Evidencia ${idx + 1} - ${elevator.internalCode ?? ""}`} className="aspect-square w-full rounded-lg border border-slate-200 object-cover" />
                          {photo.description && (
                            <p className="text-[11px] leading-snug text-slate-500">
                              {photo.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: PortalDocumentTask }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2">
      {task.isCompleted ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
      ) : (
        <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${task.isCompleted ? "text-slate-700" : "text-slate-500 line-through"}`}>
          {task.taskDescription}
          {task.isCritical && (
            <span className="ml-1.5 rounded border border-red-100 bg-red-50 px-1 py-0.5 text-[9px] font-bold uppercase text-red-600">
              Crítica
            </span>
          )}
        </p>
        {task.observations && <p className="mt-0.5 text-xs text-slate-500">Obs.: {task.observations}</p>}
      </div>
    </div>
  );
}
