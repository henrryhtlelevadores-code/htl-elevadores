"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { portalQuotationPdfAction } from "@/features/portal/actions";
import { withDownload } from "@/lib/pdf-paths";
import {
  ArrowLeft,
  Download,
  Loader2,
  LogOut,
  RefreshCw,
} from "lucide-react";

const formatDateTime = (ts: number | null | undefined) =>
  ts
    ? new Date(ts * 1000).toLocaleString("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function openPdf(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = withDownload(url, filename);
  link.target = "_blank";
  link.rel = "noopener";
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Solo lo que el portal necesita: sin costos, márgenes ni líneas internas. */
export interface PortalQuotationSummary {
  id: string;
  quotationNumber: string;
  pdfUrl: string | null;
  pdfGeneratedAt: number | null;
}

export function PortalQuotationDocument({
  detail,
  costCenterId,
}: {
  detail: PortalQuotationSummary;
  costCenterId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [pdfUrl, setPdfUrl] = useState<string | null>(detail.pdfUrl ?? null);
  const [busy, setBusy] = useState(false);

  const latestVersion = useMemo(() => {
    if (!pdfUrl) return null;
    const match = pdfUrl.match(/[?&]v=(\d+)/);
    if (!match) return null;
    return Number(match[1]) * 1000;
  }, [pdfUrl]);

  useEffect(() => {
    if (pdfUrl) return;
    startTransition(async () => {
      const res = await portalQuotationPdfAction(detail.id);
      if (res.success) {
        setPdfUrl(res.pdfUrl);
      }
    });
  }, [detail.id, pdfUrl, startTransition]);

  function handleDownload() {
    if (!pdfUrl) return;
    openPdf(pdfUrl, `Cotizacion_${detail.quotationNumber}.pdf`);
  }

  function handleRegenerate() {
    setBusy(true);
    startTransition(async () => {
      const res = await portalQuotationPdfAction(detail.id);
      if (res.success) {
        setPdfUrl(res.pdfUrl);
        toast.success(
          res.reused
            ? "Estas viendo la última versión del PDF"
            : "Última versión del PDF generada"
        );
      } else {
        toast.error("Error al generar el PDF", { description: res.error });
      }
      setBusy(false);
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/portal/${costCenterId}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800"
          >
            <ArrowLeft className="size-4" />
            Volver al portal
          </Link>
          <span className="text-xs text-slate-300">|</span>
          <p className="truncate font-mono text-xs font-semibold text-slate-700">
            {detail.quotationNumber}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pdfUrl ? (
            <span className="hidden text-[11px] text-slate-500 sm:inline">
              Última versión: {formatDateTime(latestVersion ?? detail.pdfGeneratedAt ?? null)}
            </span>
          ) : null}
          <button
            onClick={handleDownload}
            disabled={!pdfUrl || isPending || busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[#021133] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#021133]/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Descargar PDF
          </button>
          <button
            onClick={handleRegenerate}
            disabled={isPending || busy}
            title="Recargar la última versión persistida"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Regenerar
          </button>
          <form action={`/portal/${costCenterId}/logout`} method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800"
            >
              <LogOut className="size-4" />
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {pdfUrl ? (
          <iframe
            key={pdfUrl}
            title={`Cotización ${detail.quotationNumber}`}
            src={`${pdfUrl}#toolbar=0`}
            className="block w-full flex-1 min-h-[80vh] bg-white"
            style={{ height: "calc(100dvh - 64px - env(safe-area-inset-top) - env(safe-area-inset-bottom))" }}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Cargando la última versión del PDF…
          </div>
        )}
      </main>
    </div>
  );
}