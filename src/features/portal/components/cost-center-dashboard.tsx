"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PortalDashboardData, PortalQuotationItem, PortalWorkOrderItem } from "../queries";
import {
  Activity,
  ArrowRight,
  CalendarRange,
  Check,
  ChevronDown,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  PackageOpen,
  ReceiptText,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { ClientPortalTopBar } from "./client-portal-top-bar";
import { ClientHeaderCard } from "./client-header-card";

function formatDate(value: number | null): string {
  if (!value) return "—";
  const date = new Date(value < 100000000000 ? value * 1000 : value);
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function equipmentStatus(status: string | null) {
  switch (status) {
    case "OPERATIVE": return ["Operativo", "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"];
    case "MAINTENANCE": return ["En mantenimiento", "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"];
    case "STOPPED":
    case "OUT_OF_SERVICE": return ["Detenido", "border-destructive/30 bg-destructive/10 text-destructive"];
    case "PENDING_COMPLETION": return ["Sin culminar", "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400"];
    default: return [status || "Sin estado", "border-border bg-muted text-muted-foreground"];
  }
}

function workType(order: PortalWorkOrderItem) {
  return order.serviceTypeName ?? (order.type === "PREV" ? "Preventivo" : order.type === "CORR" ? "Correctivo" : "Mantenimiento");
}

function quotationStatus(status: string | null) {
  return status === "ACCEPTED"
    ? ["Aceptada", "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"]
    : ["Pendiente", "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"];
}

export function CostCenterDashboard({ data }: { data: PortalDashboardData }) {
  const { costCenter, equipments, recentWorkOrders, quotations, documents } = data;
  const [year, setYear] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [quotationTab, setQuotationTab] = useState<"pending" | "history">("pending");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sixMonthsAgo] = useState(() => Date.now() - 1000 * 60 * 60 * 24 * 30 * 6);
  const hasStopped = equipments.some((equipment) => ["STOPPED", "OUT_OF_SERVICE", "PENDING_COMPLETION"].includes(equipment.status ?? ""));
  const stoppedCount = equipments.filter((equipment) => ["STOPPED", "OUT_OF_SERVICE", "PENDING_COMPLETION"].includes(equipment.status ?? "")).length;
  const years = [...new Set(recentWorkOrders.map((order) => {
    const date = order.completedAt ?? order.createdAt;
    return date ? String(new Date(date < 100000000000 ? date * 1000 : date).getFullYear()) : null;
  }).filter(Boolean) as string[])];
  const visibleOrders = useMemo(() => recentWorkOrders.filter((order) => {
    const date = order.completedAt ?? order.createdAt;
    const timestamp = date ? (date < 100000000000 ? date * 1000 : date) : 0;
    const orderYear = date ? String(new Date(date < 100000000000 ? date * 1000 : date).getFullYear()) : "";
    const recentEnough = timestamp >= sixMonthsAgo;
    return (year === "ALL" ? recentEnough : year === orderYear) &&
      (type === "ALL" || order.type === type || (type === "PREV" && workType(order).toLowerCase().includes("prevent")) || (type === "CORR" && workType(order).toLowerCase().includes("correct")));
  }), [recentWorkOrders, sixMonthsAgo, type, year]);
  const pendingQuotes = quotations.filter((quote) => quote.status === "SENT");
  const historyQuotes = quotations.filter((quote) => quote.status === "ACCEPTED");
  const lastVisit = recentWorkOrders.find((order) => order.status === "COMPLETED")?.completedAt ?? null;
  const activeOrders = visibleOrders.length;
  const activeOrdersLabel = activeOrders === 1 ? "orden activa" : "órdenes activas";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <ClientPortalTopBar costCenterId={costCenter.id} costCenterName={costCenter.name} />
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-5 sm:px-6 sm:py-8">
        <ClientHeaderCard
          costCenter={costCenter}
          hasStopped={hasStopped}
          stoppedCount={stoppedCount}
          lastVisitLabel={formatDate(lastVisit)}
        />

        <section>
          <SectionTitle icon={<Wrench className="size-5" />} title="Equipos" subtitle={`${equipments.length} ${equipments.length === 1 ? "equipo" : "equipos"} monitoreados`} />
          {equipments.length === 0 ? (
            <EmptyState icon={<PackageOpen className="size-8" />} title="No hay equipos registrados" description="Aún no se han vinculado ascensores a este edificio." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {equipments.map((equipment) => {
                const [label, classes] = equipmentStatus(equipment.status);
                const isOperational = equipment.status === "OPERATIVE";
                return (
                  <article key={equipment.id} className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/30">
                    <div className="flex items-start gap-2">
                      <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-bold">{equipment.internalCode}</span>
                      <h3 className="truncate text-sm font-bold flex-1">{equipment.name}</h3>
                      {isOperational ? (
                        <ShieldCheck className="size-4 shrink-0 text-emerald-500" aria-label="Salud del equipo" />
                      ) : null}
                    </div>
                    <p className="mt-2 truncate text-xs text-muted-foreground">
                      {[equipment.brandName, equipment.elevatorTypeName, equipment.floors != null ? `${equipment.floors} niveles` : null].filter(Boolean).join(" · ") || "Equipo de elevación"}
                    </p>
                    <span className={`mt-3 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${classes}`}>
                      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                      {label}
                    </span>
                    <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <p className="truncate">Última visita: <span className="text-foreground">{formatDate(equipment.lastVisitDate)}</span></p>
                      <p className="truncate">Próxima: <span className="text-foreground">{formatDate(equipment.nextVisitDate)}</span></p>
                    </div>
                    <Link
                      href={`/portal/${costCenter.id}/equipos/${equipment.id}`}
                      className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-md px-2 -mx-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 hover:underline dark:text-sky-300"
                    >
                      Ver historial
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SectionTitle icon={<Activity className="size-5" />} title="Órdenes de Trabajo" subtitle={`${activeOrders} ${activeOrdersLabel}`} />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen((value) => !value)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted lg:hidden"
                aria-expanded={filtersOpen}
                aria-controls="work-orders-filters"
              >
                <CalendarRange className="size-3.5" />
                Filtros
                <ChevronDown className={`size-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
              </button>
              <div id="work-orders-filters" className={`${filtersOpen ? "flex" : "hidden"} w-full flex-col gap-2 sm:flex-row lg:flex`}>
                <select value={year} onChange={(event) => setYear(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
                  <option value="ALL">Todos los años</option>
                  {years.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
                  <option value="ALL">Todas</option>
                  <option value="PREV">Preventivo</option>
                  <option value="CORR">Correctivo</option>
                </select>
              </div>
            </div>
          </div>
          {visibleOrders.length === 0 ? (
            <EmptyState icon={<FolderOpen className="size-8" />} title="Aún no hay órdenes registradas" description="Cuando se atienda una OT aparecerá en esta sección." />
          ) : (
            <div className="space-y-3">
              {visibleOrders.map((order) => (
                <WorkOrderPublicCard key={order.id} order={order} costCenterId={costCenter.id} />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle icon={<ReceiptText className="size-5" />} title="Cotizaciones" />
          <div role="tablist" aria-label="Cotizaciones" className="mb-3 flex rounded-lg bg-muted p-1">
            <button
              role="tab"
              aria-selected={quotationTab === "pending"}
              onClick={() => setQuotationTab("pending")}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${quotationTab === "pending" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Pendientes
            </button>
            <button
              role="tab"
              aria-selected={quotationTab === "history"}
              onClick={() => setQuotationTab("history")}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${quotationTab === "history" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Historial
            </button>
          </div>
          {(quotationTab === "pending" ? pendingQuotes : historyQuotes).length === 0 ? (
            <EmptyState
              icon={<ReceiptText className="size-8" />}
              title={quotationTab === "pending" ? "Sin cotizaciones pendientes" : "Sin historial"}
              description={quotationTab === "pending" ? "Cuando recibas una nueva cotización aparecerá aquí." : "Las cotizaciones aceptadas se mostrarán en esta pestaña."}
            />
          ) : (
            <div className="space-y-3">
              {(quotationTab === "pending" ? pendingQuotes : historyQuotes).map((quote) => (
                <QuotationPublicCard key={quote.id} quote={quote} costCenterId={costCenter.id} />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle icon={<FileText className="size-5" />} title="Documentos" />
          {documents.length === 0 ? (
            <EmptyState icon={<FolderOpen className="size-8" />} title="No hay documentos disponibles" description="Los informes y constancias se publicarán aquí." />
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {documents.map((document) => (
                <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between gap-3 p-4 text-sm transition-colors hover:bg-muted">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0 text-primary dark:text-sky-300" />
                    <span className="truncate">{document.name}</span>
                  </span>
                  <Download className="size-4 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          )}
        </section>

        <p className="pb-6 text-center text-[11px] text-muted-foreground">© {new Date().getFullYear()} HTL Elevadores · Portal del cliente</p>
      </main>
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-primary dark:text-sky-300">{icon}</span>
        <h2 className="truncate text-lg font-bold">{title}</h2>
      </div>
      {subtitle ? <span className="text-[11px] font-medium text-muted-foreground">{subtitle}</span> : null}
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
      <div className="text-muted-foreground/70">{icon}</div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function WorkOrderPublicCard({ order, costCenterId }: { order: PortalWorkOrderItem; costCenterId: string }) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{formatDate(order.completedAt ?? order.createdAt)}</p>
          <h3 className="mt-1 font-mono text-sm font-bold">{order.otNumber}</h3>
          <p className="mt-1 text-sm font-semibold">{workType(order)}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <FileText className="size-3" />
          Aprobada
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{order.equipmentCount} equipo(s) · Técnico: {order.technicianName ?? "—"}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/portal/${costCenterId}/informes/${order.id}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <FileText className="size-4" />
          Ver informe
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}

function QuotationPublicCard({ quote, costCenterId }: { quote: PortalQuotationItem; costCenterId: string }) {
  const [label, classes] = quotationStatus(quote.status);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(quote.status === "ACCEPTED");

  async function handleAccept() {
    if (accepting || accepted) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/portal/${costCenterId}/quotations/${quote.id}/accept`, {
        method: "POST",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "No se pudo aceptar la cotización");
      }
      setAccepted(true);
    } catch (error) {
      console.error(error);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-sm font-bold">{quote.quotationNumber}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(quote.issueDate)}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${classes}`}>
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
          {accepted ? "Aceptada" : label}
        </span>
      </div>
      <p className="mt-3 text-lg font-bold">Total: S/ {Number(quote.total ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</p>
      <p className="mt-1 text-xs text-muted-foreground">Válido hasta: {formatDate(quote.validUntil)}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`/portal/${costCenterId}/cotizaciones/${quote.id}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-primary/30 bg-card px-4 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
        >
          <FileText className="size-4" />
          Ver cotización y PDF
        </Link>
        {!accepted ? (
          <button
            type="button"
            onClick={handleAccept}
            disabled={accepting}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accepting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Aceptar cotización
          </button>
        ) : null}
      </div>
    </article>
  );
}