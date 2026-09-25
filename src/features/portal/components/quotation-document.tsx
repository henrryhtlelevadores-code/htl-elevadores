"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { QuotationDetail } from "@/features/quotations/actions";
import { getQuotationPdfDataUrl } from "@/features/quotations/quotation-pdf-actions";
import {
  ArrowLeft,
  Building2,
  Download,
  Loader2,
  LogOut,
} from "lucide-react";

const money = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  });

const formatDate = (ts: number | null | undefined) =>
  ts
    ? new Date(ts * 1000).toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
};

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: "bg-amber-50 text-amber-700 border border-amber-100",
  SENT: "bg-blue-50 text-blue-700 border border-blue-100",
  ACCEPTED: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  REJECTED: "bg-red-50 text-red-700 border border-red-100",
};

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function PortalQuotationDocument({
  detail,
  costCenterId,
}: {
  detail: QuotationDetail;
  costCenterId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);

  function handleDownload() {
    setDownloading(true);
    startTransition(async () => {
      const res = await getQuotationPdfDataUrl(detail.id);
      if ("dataUrl" in res && res.dataUrl) {
        downloadDataUrl(res.dataUrl, `Cotizacion_${detail.quotationNumber}.pdf`);
        toast.success("PDF descargado");
      } else {
        toast.error("Error al generar el PDF", {
          description: "error" in res ? res.error : undefined,
        });
      }
      setDownloading(false);
    });
  }

  const statusKey = detail.status ?? "DRAFT";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        {/* Topbar */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/portal/${costCenterId}`}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al portal
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDownload}
              disabled={isPending || downloading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#021133] hover:bg-[#021133]/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Descargar PDF
            </button>
            <form action={`/portal/${costCenterId}/logout`} method="post">
              <button
                type="submit"
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Salir
              </button>
            </form>
          </div>
        </div>

        {/* Document */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#021133] flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">HTL ELEVADORES</h1>
                <p className="text-sm text-slate-500">Cotización de servicios</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="font-mono font-bold text-slate-900">{detail.quotationNumber}</p>
              <span
                className={`inline-block mt-1 px-3 py-1 text-xs rounded-full font-medium ${STATUS_CLASSES[statusKey] ?? "bg-slate-100 text-slate-600"}`}
              >
                {STATUS_LABELS[statusKey] ?? detail.status}
              </span>
            </div>
          </div>

          {/* Data */}
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
                  Cliente
                </div>
                <div className="text-sm font-medium text-slate-800 truncate">
                  {detail.client_name ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
                  Sede
                </div>
                <div className="text-sm font-medium text-slate-800 truncate">
                  {detail.cost_center_name ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
                  Asesor
                </div>
                <div className="text-sm font-medium text-slate-800 truncate">
                  {detail.advisor_name ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
                  Válida hasta
                </div>
                <div className="text-sm font-medium text-slate-800">{formatDate(detail.validUntil)}</div>
              </div>
            </div>

            {/* Lines */}
            <div className="space-y-4 mb-6">
              {detail.lines.map((line, idx) => (
                <div key={line.id} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-start justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900">
                        {String(idx + 1).padStart(2, "0")}. {line.description}
                      </p>
                      {line.elevator_internal_code || line.elevator_name ? (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Equipo:{" "}
                          {[line.elevator_internal_code, line.elevator_name]
                            .filter(Boolean)
                            .join(" — ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm text-slate-900">{money(line.clientPrice)}</p>
                      <p className="text-[10px] text-slate-400">precio venta (+IGV)</p>
                    </div>
                  </div>

                  {line.products.length > 0 ? (
                    <div className="px-4 py-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-slate-400 border-b border-slate-100">
                            <th className="py-1.5 font-medium">Descripción</th>
                            <th className="py-1.5 font-medium text-right">Cant.</th>
                            <th className="py-1.5 font-medium text-right">C. Unit.</th>
                            <th className="py-1.5 font-medium text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {line.products.map((p, i) => (
                            <tr key={i} className="border-b border-slate-50">
                              <td className="py-1.5 text-slate-700">{p.description}</td>
                              <td className="py-1.5 text-slate-700 text-right">
                                {p.quantity} {p.unit}
                              </td>
                              <td className="py-1.5 text-slate-700 text-right">{money(p.unitCost)}</td>
                              <td className="py-1.5 text-slate-700 text-right">{money(p.totalCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="max-w-sm ml-auto space-y-1.5 text-sm border border-slate-200 rounded-xl p-4 mb-6">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal (sin IGV)</span>
                <span>{money(detail.subtotal)}</span>
              </div>
              {Number(detail.discountAmount ?? 0) > 0 ? (
                <div className="flex justify-between text-slate-500">
                  <span>Descuento ({Math.round((detail.discountRate ?? 0) * 100)}%)</span>
                  <span>-{money(detail.discountAmount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-slate-500">
                <span>Base imponible</span>
                <span>{money(detail.taxableBase)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>IGV (18%)</span>
                <span>{money(detail.igv)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-slate-100">
                <span>TOTAL</span>
                <span>{money(detail.total)}</span>
              </div>
            </div>

            {/* Notes & Terms */}
            {detail.notes ? (
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-1">
                  Notas
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{detail.notes}</p>
              </div>
            ) : null}
            {detail.terms ? (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-1">
                  Condiciones
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{detail.terms}</p>
              </div>
            ) : null}
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-6">
          © {new Date().getFullYear()} HTL Elevadores · Portal del cliente
        </p>
      </div>
    </div>
  );
}