"use client";

import Link from "next/link";
import type { PortalDashboardData, PortalInformeItem } from "../queries";
import {
  Building2,
  MapPin,
  CheckCircle2,
  LogOut,
  Wrench,
  Activity,
  FileText,
  ArrowRight,
} from "lucide-react";

const COVER_FALLBACK =
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=2000&auto=format&fit=crop";

function formatDate(unix: number | null): string {
  if (!unix) return "Fecha no registrada";
  const date = new Date(unix * 1000);
  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function equipmentStatusLabel(status: string | null): {
  label: string;
  dot: string;
  text: string;
} {
  switch (status) {
    case "OPERATIVE":
      return { label: "Operativo", dot: "bg-emerald-500", text: "text-emerald-600" };
    case "MAINTENANCE":
      return { label: "En mantenimiento", dot: "bg-amber-500", text: "text-amber-600" };
    case "OUT_OF_SERVICE":
      return { label: "Fuera de servicio", dot: "bg-red-500", text: "text-red-600" };
    default:
      return { label: status || "Desconocido", dot: "bg-slate-400", text: "text-slate-500" };
  }
}

function workOrderStatusLabel(status: string | null): { label: string; className: string } {
  switch (status) {
    case "COMPLETED":
      return {
        label: "Completado",
        className: "bg-emerald-50 text-emerald-700 border border-emerald-100",
      };
    case "IN_PROGRESS":
      return { label: "En proceso", className: "bg-amber-50 text-amber-700 border border-amber-100" };
    case "PENDING":
      return { label: "Pendiente", className: "bg-slate-100 text-slate-600" };
    default:
      return { label: status || "—", className: "bg-slate-100 text-slate-600" };
  }
}

const LEGACY_TYPE_LABELS: Record<string, string> = {
  CORRECTIVE: "Mantenimiento Correctivo",
  PREVENTIVE: "Mantenimiento Preventivo",
  PREDICTIVE: "Mantenimiento Predictivo",
  INSTALLATION: "Instalación",
};

function typeLabel(item: { type: string | null; serviceTypeName: string | null }): string {
  if (item.serviceTypeName) return item.serviceTypeName;
  if (item.type && LEGACY_TYPE_LABELS[item.type]) return LEGACY_TYPE_LABELS[item.type];
  return item.type || "—";
}

function informeLink(costCenterId: string, item: PortalInformeItem): string {
  return `/portal/${costCenterId}/informes/${item.id}`;
}

export function CostCenterDashboard({ data }: { data: PortalDashboardData }) {
  const { costCenter, equipments, recentWorkOrders, informes } = data;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Cover Image */}
      <div
        className="h-56 w-full bg-cover bg-center"
        style={{
          backgroundImage: `url(${costCenter.mainPhotoUrl || COVER_FALLBACK})`,
          backgroundColor: "#e2e8f0",
        }}
      />

      {/* Contenedor Principal */}
      <div className="max-w-5xl mx-auto px-6 sm:px-12 pb-20">
        {/* Cabecera Superior (Botón Salir) */}
        <div className="flex justify-end pt-4 relative z-20">
          <form action={`/portal/${costCenter.id}/logout`} method="post">
            <button
              type="submit"
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </form>
        </div>

        {/* Bloque del Ícono (Aislado con margen negativo, flota sobre la imagen) */}
        <div className="-mt-16 sm:-mt-20 mb-4 relative z-10">
          <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white rounded-xl border border-slate-200 flex items-center justify-center shadow-sm">
            <Building2 className="w-10 h-10 sm:w-12 sm:h-12 text-[#021133]" />
          </div>
        </div>

        {/* Bloque de Texto (Reposa sobre el fondo blanco) */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-2 truncate">
            {costCenter.name}
          </h1>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm">
            <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {[costCenter.address, costCenter.district].filter(Boolean).join(", ") ||
                  "Dirección no registrada"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-emerald-600 font-medium shrink-0">
              <CheckCircle2 className="w-4 h-4" />
              <span>Mantenimiento al día</span>
            </div>
          </div>
        </div>

        <hr className="border-slate-100 mb-10" />

        {/* Grid de Contenido Principal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Columna Izquierda: Equipos y OTs (2/3 del espacio) */}
          <div className="md:col-span-2 space-y-8">
            <section>
              <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#021133]" /> Equipos Instalados
              </h2>
              {equipments.length === 0 ? (
                <div className="p-6 rounded-lg bg-white border border-slate-200 text-sm text-slate-500">
                  No hay equipos registrados para este edificio.
                </div>
              ) : (
                <div className="space-y-3">
                  {equipments.map((e) => {
                    const status = equipmentStatusLabel(e.status);
                    return (
                      <div
                        key={e.id}
                        className="p-4 rounded-lg bg-white border border-slate-200 flex justify-between items-center gap-3 hover:bg-slate-50 transition-colors cursor-default"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {e.internalCode || e.name}
                          </p>
                          <p className="text-sm text-slate-500 truncate">
                            {[e.brandName, e.modelName, e.elevatorTypeName]
                              .filter(Boolean)
                              .join(" • ") || "Equipo"}
                            {e.stops != null && e.floors != null ? ` • ${e.floors} niveles` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                          <span className={`text-sm font-medium ${status.text}`}>
                            {status.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#021133]" /> Últimas Órdenes de Trabajo
              </h2>
              {recentWorkOrders.length === 0 ? (
                <div className="p-6 rounded-lg bg-white border border-slate-200 text-sm text-slate-500">
                  No hay órdenes de trabajo registradas todavía.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentWorkOrders.map((wo) => {
                    const status = workOrderStatusLabel(wo.status);
                    return (
                      <div
                        key={wo.id}
                        className="p-4 rounded-lg bg-white border border-slate-200 flex justify-between items-center gap-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {wo.otNumber} ·{" "}
                            {wo.type === "PREVENTIVE"
                              ? "Mantenimiento Preventivo"
                              : "Mantenimiento Correctivo"}
                          </p>
                          <p className="text-sm text-slate-500">
                            {wo.scheduledDate
                              ? `Programado el ${formatDate(Number(wo.scheduledDate))}`
                              : wo.scheduledTime
                                ? `Programado a las ${wo.scheduledTime}`
                                : `Registrado el ${formatDate(wo.createdAt)}`}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 text-xs rounded-full font-medium shrink-0 ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Columna Derecha: Informes y Documentos (1/3 del espacio) */}
          <div className="space-y-6">
            <div className="p-5 sm:p-6 rounded-lg bg-white border border-slate-200">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#021133]" /> Informes y Documentos
              </h3>
              {informes.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Aún no hay informes emitidos para este edificio.
                </p>
              ) : (
                <ul className="space-y-3">
                  {informes.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={informeLink(costCenter.id, item)}
                        className="group block p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono font-semibold text-sm text-slate-900 truncate">
                            {item.otNumber}
                          </p>
                          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#021133] transition-colors shrink-0" />
                        </div>
                        <p className="text-xs text-slate-500 mt-1 truncate">
                          {typeLabel(item)}
                          {item.completedAt
                            ? ` • ${formatDate(item.completedAt)}`
                            : ""}
                        </p>
                        <p className="text-xs text-slate-400">
                          {item.equipmentCount} equipo(s) atendido(s)
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#021133] mt-2">
                          <FileText className="w-3.5 h-3.5" />
                          Ver documento
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <hr className="border-slate-100 mt-10 mb-6" />
        <p className="text-center text-[11px] text-slate-400">
          © {new Date().getFullYear()} HTL Elevadores · Portal del cliente
        </p>
      </div>
    </div>
  );
}