import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, ClipboardList, Cpu } from "lucide-react";
import { getPortalEquipmentHistory } from "@/features/portal/queries";
import { getPortalSessionCostCenterId } from "@/features/portal/server";

function formatDate(value: number | null) {
  if (!value) return "—";
  const timestamp = value < 100000000000 ? value * 1000 : value;
  return new Date(timestamp).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function PortalEquipmentHistoryPage({
  params,
}: {
  params: Promise<{ costCenterId: string; elevatorId: string }>;
}) {
  const { costCenterId, elevatorId } = await params;
  if (await getPortalSessionCostCenterId() !== costCenterId) redirect(`/portal/${costCenterId}/login`);
  const { equipment, orders } = await getPortalEquipmentHistory(costCenterId, elevatorId);
  if (!equipment) notFound();

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-[900px] space-y-5 px-4 py-5 sm:px-6 sm:py-8">
        <Link href={`/portal/${costCenterId}`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="size-4" /> Volver al portal
        </Link>
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-[#021133] text-white"><Cpu className="size-5" /></div>
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold text-slate-500">{equipment.internalCode}</p>
              <h1 className="truncate text-xl font-bold">{equipment.name}</h1>
              <p className="mt-1 text-xs text-slate-500">{[equipment.brandName, equipment.elevatorTypeName, equipment.floors != null ? `${equipment.floors} niveles` : null].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        </header>
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><ClipboardList className="size-5 text-[#021133]" />Historial de órdenes de trabajo</h2>
          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">Aún no hay órdenes aprobadas para este equipo.</div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <article key={order.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xs text-slate-500">{formatDate(order.completedAt)}</p><h3 className="mt-1 font-mono text-sm font-bold">{order.otNumber}</h3><p className="mt-1 text-sm font-semibold">{order.serviceTypeName ?? "Orden de trabajo"}</p></div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="size-3.5" /> Aprobada</span>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays className="size-3.5" />Programada: {order.scheduledDate ?? "—"} · Técnico: {order.technicianName ?? "—"}</p>
                  <Link href={`/portal/${costCenterId}/informes/${order.id}?elevatorId=${order.workOrderElevatorId}`} className="mt-3 inline-flex text-xs font-semibold text-[#021133]">Ver informe →</Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
