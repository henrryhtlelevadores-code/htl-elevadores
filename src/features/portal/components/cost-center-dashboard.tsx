"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PortalDashboardData, PortalQuotationItem, PortalWorkOrderItem } from "../queries";
import { Activity, ArrowRight, Building2, Download, FileText, LogOut, MapPin, Phone, ReceiptText, Wrench } from "lucide-react";

function formatDate(value: number | null): string {
  if (!value) return "—";
  const date = new Date(value < 100000000000 ? value * 1000 : value);
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function equipmentStatus(status: string | null) {
  switch (status) {
    case "OPERATIVE": return ["Operativo", "bg-emerald-50 text-emerald-700 border-emerald-200"];
    case "MAINTENANCE": return ["En mantenimiento", "bg-blue-50 text-blue-700 border-blue-200"];
    case "STOPPED":
    case "OUT_OF_SERVICE": return ["Detenido", "bg-red-50 text-red-700 border-red-200"];
    case "PENDING_COMPLETION": return ["Sin culminar", "bg-orange-50 text-orange-700 border-orange-200"];
    default: return [status || "Sin estado", "bg-slate-100 text-slate-600 border-slate-200"];
  }
}

function workType(order: PortalWorkOrderItem) {
  return order.serviceTypeName ?? (order.type === "PREV" ? "Preventivo" : order.type === "CORR" ? "Correctivo" : "Mantenimiento");
}

function quotationStatus(status: string | null) {
  return status === "ACCEPTED"
    ? ["Aceptada", "bg-emerald-50 text-emerald-700 border-emerald-200"]
    : ["Pendiente", "bg-blue-50 text-blue-700 border-blue-200"];
}

export function CostCenterDashboard({ data }: { data: PortalDashboardData }) {
  const { costCenter, equipments, recentWorkOrders, quotations, documents } = data;
  const [year, setYear] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [quotationTab, setQuotationTab] = useState<"pending" | "history">("pending");
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

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-[900px] space-y-8 px-4 py-5 sm:px-6 sm:py-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#021133] text-white"><Building2 className="size-5" /></div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold sm:text-2xl">{costCenter.name}</h1>
                <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500"><MapPin className="mt-0.5 size-4 shrink-0" />{[costCenter.address, costCenter.district].filter(Boolean).join(", ") || "Dirección no registrada"}</p>
                {(costCenter.contactName || costCenter.contactPhone) && <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><span>👤</span>{costCenter.contactName ?? "Contacto"}{costCenter.contactPhone && <><span>·</span><Phone className="size-3.5" />{costCenter.contactPhone}</>}</p>}
              </div>
            </div>
            <form action={`/portal/${costCenter.id}/logout`} method="post"><button type="submit" className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900"><LogOut className="size-4" />Salir</button></form>
          </div>
          <div className={`mt-5 inline-flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${hasStopped ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {hasStopped ? `⚠ ${stoppedCount} equipo(s) requiere(n) atención` : <>✅ Mantenimiento al día <span className="font-normal">Última: {formatDate(lastVisit)} · Próxima: —</span></>}
          </div>
        </header>

        <section>
          <SectionTitle icon={<Wrench className="size-5" />} title="Equipos" />
          {equipments.length === 0 ? <EmptyState>No hay equipos registrados</EmptyState> : <div className="grid gap-3 sm:grid-cols-2">{equipments.map((equipment) => { const [label, classes] = equipmentStatus(equipment.status); return <article key={equipment.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-bold">{equipment.internalCode}</span><h3 className="truncate text-sm font-bold">{equipment.name}</h3></div><p className="mt-2 truncate text-xs text-slate-500">{[equipment.brandName, equipment.elevatorTypeName, equipment.floors != null ? `${equipment.floors} niveles` : null].filter(Boolean).join(" · ") || "Equipo de elevación"}</p><span className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${classes}`}>● {label}</span><div className="mt-3 space-y-1 text-xs text-slate-500"><p>Última visita: {formatDate(equipment.lastVisitDate)}</p><p>Próxima: {formatDate(equipment.nextVisitDate)}</p></div><button type="button" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#021133]">Ver historial <ArrowRight className="size-3.5" /></button></article>; })}</div>}
        </section>

        <section>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><SectionTitle icon={<Activity className="size-5" />} title="Órdenes de Trabajo" /><div className="flex gap-2"><select value={year} onChange={(event) => setYear(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><option value="ALL">Todos los años</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select><select value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><option value="ALL">Todas</option><option value="PREV">Preventivo</option><option value="CORR">Correctivo</option></select></div></div>
          {visibleOrders.length === 0 ? <EmptyState>Aún no hay órdenes de trabajo registradas</EmptyState> : <div className="space-y-3">{visibleOrders.map((order) => <WorkOrderPublicCard key={order.id} order={order} costCenterId={costCenter.id} />)}</div>}
        </section>

        <section><SectionTitle icon={<ReceiptText className="size-5" />} title="Cotizaciones" /><div className="mb-3 flex rounded-lg bg-slate-100 p-1"><button onClick={() => setQuotationTab("pending")} className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${quotationTab === "pending" ? "bg-white shadow-sm" : "text-slate-500"}`}>Pendientes</button><button onClick={() => setQuotationTab("history")} className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${quotationTab === "history" ? "bg-white shadow-sm" : "text-slate-500"}`}>Historial</button></div>{(quotationTab === "pending" ? pendingQuotes : historyQuotes).length === 0 ? <EmptyState>{quotationTab === "pending" ? "No tienes cotizaciones pendientes" : "No hay cotizaciones en el historial"}</EmptyState> : <div className="space-y-3">{(quotationTab === "pending" ? pendingQuotes : historyQuotes).map((quote) => <QuotationPublicCard key={quote.id} quote={quote} costCenterId={costCenter.id} />)}</div>}</section>

        <section><SectionTitle icon={<FileText className="size-5" />} title="Documentos" />{documents.length === 0 ? <EmptyState>No hay documentos disponibles</EmptyState> : <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">{documents.map((document) => <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 p-4 text-sm hover:bg-slate-50"><span className="flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0 text-[#021133]" /><span className="truncate">{document.name}</span></span><Download className="size-4 shrink-0 text-slate-500" /></a>)}</div>}</section>

        <p className="pb-6 text-center text-[11px] text-slate-400">© {new Date().getFullYear()} HTL Elevadores · Portal del cliente</p>
      </div>
    </main>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) { return <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><span className="text-[#021133]">{icon}</span>{title}</h2>; }
function EmptyState({ children }: { children: React.ReactNode }) { return <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">{children}</div>; }

function WorkOrderPublicCard({ order, costCenterId }: { order: PortalWorkOrderItem; costCenterId: string }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-slate-500">{formatDate(order.completedAt ?? order.createdAt)}</p><h3 className="mt-1 font-mono text-sm font-bold">{order.otNumber}</h3><p className="mt-1 text-sm font-semibold">{workType(order)}</p></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">✓ Aprobada</span></div><p className="mt-3 text-xs text-slate-500">{order.equipmentCount} equipo(s) · Técnico: {order.technicianName ?? "—"}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500"><span>✓ Reporte disponible</span><span>⏱ {order.completedAt ? "Completada" : "En proceso"}</span></div><div className="mt-4 flex flex-wrap gap-2"><Link href={`/portal/${costCenterId}/informes/${order.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[#021133] px-3 py-2 text-xs font-semibold text-white">📄 Ver informe <ArrowRight className="size-3.5" /></Link></div></article>;
}

function QuotationPublicCard({ quote, costCenterId }: { quote: PortalQuotationItem; costCenterId: string }) {
  const [label, classes] = quotationStatus(quote.status);
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-mono text-sm font-bold">{quote.quotationNumber}</h3><p className="mt-1 text-xs text-slate-500">{formatDate(quote.issueDate)}</p></div><span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${classes}`}>{label}</span></div><p className="mt-3 text-lg font-bold">Total: S/ {Number(quote.total ?? 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</p><p className="mt-1 text-xs text-slate-500">Válido hasta: {formatDate(quote.validUntil)}</p><Link href={`/portal/${costCenterId}/cotizaciones/${quote.id}`} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#021133]">Ver cotización y PDF <ArrowRight className="size-3.5" /></Link></article>;
}
