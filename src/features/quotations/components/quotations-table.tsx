"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import type {
  QuotationDetail,
  QuotationFormOptions,
  QuotationWithRelations,
} from "../actions";
import { getQuotationById, deleteQuotation, updateQuotationStatus } from "../actions";
import { generateAndStoreQuotationPdf } from "../quotation-pdf-actions";
import { DEFAULT_PRICING_RULES, type PricingRules } from "../calc";
import type { LineModeSummary } from "../actions";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Calculator,
  Download,
  Eye,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Info,
} from "lucide-react";
import { QuotationCreateDialog } from "./quotation-create-dialog";
import { QuotationDetailDialog } from "./quotation-detail-dialog";
import { PricingConfigDialog } from "./pricing-config-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface QuotationsTableProps {
  initialQuotations: QuotationWithRelations[];
  options: QuotationFormOptions;
  defaultHourlyCost: number;
  pricingRules: PricingRules;
  lineModes: Record<string, LineModeSummary>;
  currentUser: { id: string; fullName: string | null } | null;
}

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

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-800 border-amber-300",
  SENT: "bg-blue-100 text-blue-800 border-blue-300",
  ACCEPTED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  REJECTED: "bg-red-100 text-red-800 border-red-300",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
};

function openPdf(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function ActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>{label}</TooltipContent>
    </Tooltip>
  );
}

export function QuotationsTable({
  initialQuotations,
  options,
  defaultHourlyCost,
  pricingRules: initialRules,
  lineModes: initialLineModes,
  currentUser,
}: QuotationsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingDetail, setEditingDetail] = useState<QuotationDetail | null>(null);
  const [viewingDetail, setViewingDetail] = useState<QuotationDetail | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuotationWithRelations | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [configSession, setConfigSession] = useState(0);
  const [hourlyCost, setHourlyCost] = useState(defaultHourlyCost);
  const [pricingRules, setPricingRules] = useState<PricingRules>(
    initialRules ?? DEFAULT_PRICING_RULES
  );
  const [lineModes, setLineModes] = useState<Record<string, LineModeSummary>>(
    initialLineModes ?? {}
  );
  const refresh = useCallback(() => router.refresh(), [router]);

  async function handleView(id: string) {
    router.push(`/quotations/${id}`);
  }

  async function handleEdit(id: string) {
    const detail = await getQuotationById(id);
    setEditingDetail(detail);
    setCreateOpen(true);
  }

  function handleNew() {
    setEditingDetail(null);
    setCreateOpen(true);
  }

  function handleDelete(row: QuotationWithRelations) {
    setDeleteTarget(row);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const row = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      const res = await deleteQuotation(row.id);
      if (res.success) {
        toast.success(res.message);
        refresh();
      } else {
        toast.error("Error al eliminar", { description: res.error });
      }
    });
  }

  async function handleStatusChange(id: string, status: string) {
    const res = await updateQuotationStatus(id, status);
    if (res.success) {
      toast.success(res.message);
      if (viewingDetail?.id === id) {
        const updated = await getQuotationById(id);
        setViewingDetail(updated);
      }
      refresh();
    } else {
      toast.error("Error al actualizar estado", { description: res.error });
    }
  }

  async function handleDownload(row: QuotationWithRelations) {
    startTransition(async () => {
      const res = await generateAndStoreQuotationPdf(row.id);
      if (res.success) {
        openPdf(res.pdfUrl, `Cotizacion_${row.quotationNumber}.pdf`);
        toast.success(
          res.reused ? "PDF descargado (almacenado)" : "PDF generado y descargado"
        );
      } else {
        toast.error("Error al generar el PDF", { description: res.error });
      }
    });
  }

  const columns = useMemo<ColumnDef<QuotationWithRelations>[]>(
    () => [
      {
        accessorKey: "quotationNumber",
        header: "N°",
        size: 120,
        cell: ({ row }) => (
          <span className="font-mono font-semibold text-xs">{row.original.quotationNumber}</span>
        ),
      },
      {
        accessorKey: "client_name",
        header: "Cliente",
        size: 220,
        cell: ({ row }) => (
          <span className="block max-w-[220px] whitespace-normal break-words text-xs font-medium leading-snug">
            {row.original.client_name ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "cost_center_name",
        header: "Sede",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.cost_center_name ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "advisor_name",
        header: "Asesor",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.advisor_name ?? "—"}</span>
        ),
      },
      {
        accessorKey: "issueDate",
        header: "Emisión",
        cell: ({ row }) => <span className="text-xs">{formatDate(row.original.issueDate)}</span>,
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={`border text-[10px] font-bold ${
              STATUS_STYLES[row.original.status ?? "DRAFT"] ?? ""
            }`}
          >
            {STATUS_LABELS[row.original.status ?? "DRAFT"] ?? row.original.status}
          </Badge>
        ),
      },
      {
        id: "discountBadge",
        header: "Tipo desc.",
        cell: ({ row }) => {
          const q = row.original;
          const mode = q.discountMode ?? "PERCENT";
          if (mode === "PERCENT") {
            const pct = q.discountRate ?? 0;
            if (pct <= 0) {
              return <span className="text-xs text-muted-foreground">—</span>;
            }
            return (
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold"
              >
                −{Math.round(pct)}%
              </Badge>
            );
          }
          if (mode === "AMOUNT") {
            const amount = q.discountAmount ?? 0;
            if (amount <= 0) {
              return <span className="text-xs text-muted-foreground">—</span>;
            }
            return (
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold"
              >
                −S/ {amount.toFixed(2)}
              </Badge>
            );
          }
          // FINAL
          const target = q.targetTotal ?? 0;
          if (target <= 0) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <Badge
              variant="outline"
              className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-bold"
            >
              Final S/ {target.toFixed(2)}
            </Badge>
          );
        },
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => (
          <span className="block text-right text-xs font-bold">{money(row.original.total)}</span>
        ),
      },
      {
        accessorKey: "lineCount",
        header: "Líneas",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{row.original.lineCount}</span>
        ),
      },
      {
        id: "lineModes",
        header: "Modos",
        cell: ({ row }) => {
          const summary = lineModes[row.original.id];
          if (!summary || summary === "ALL_CALCULATED") {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          if (summary === "MANUAL_PRICE") {
            return (
              <Badge
                variant="outline"
                className="border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400 text-[10px] font-bold"
              >
                Precio manual
              </Badge>
            );
          }
          if (summary === "PASSTHROUGH") {
            return (
              <Badge
                variant="outline"
                className="border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-400 text-[10px] font-bold"
              >
                Proveedor externo
              </Badge>
            );
          }
          return (
            <Badge
              variant="outline"
              className="border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400 text-[10px] font-bold"
            >
              Mixto
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <ActionTooltip label="Ver detalle"><Button variant="ghost" size="sm" aria-label="Ver detalle" className="size-7 h-7 text-muted-foreground hover:text-foreground" onClick={() => handleView(row.original.id)}><Eye className="size-3.5" /></Button></ActionTooltip>
            <ActionTooltip label="Editar"><Button variant="ghost" size="sm" aria-label="Editar" className="size-7 h-7 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(row.original.id)}><Pencil className="size-3.5" /></Button></ActionTooltip>
            <ActionTooltip label="Descargar PDF"><Button variant="ghost" size="sm" aria-label="Descargar PDF" className="size-7 h-7 text-muted-foreground hover:text-foreground" disabled={isPending} onClick={() => handleDownload(row.original)}><Download className="size-3.5" /></Button></ActionTooltip>
            <ActionTooltip label="Eliminar"><Button variant="ghost" size="sm" aria-label="Eliminar" className="size-7 h-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(row.original)}><Trash2 className="size-3.5" /></Button></ActionTooltip>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPending]
  );

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={initialQuotations}
        searchPlaceholder="Buscar por N°, cliente o sede..."
        emptyState={
          <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Calculator className="size-8 text-muted-foreground/40" />
            No hay cotizaciones registradas. Crea la primera para comenzar.
          </div>
        }
        extraActions={
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs sm:w-auto"
              onClick={() => {
                setConfigSession((s) => s + 1);
                setConfigOpen(true);
              }}
              title={`Configuración completa: gasto estructural ${Math.round(pricingRules.overheadRateQuote * 100)}%, gastos administrativos ${Math.round(pricingRules.overheadRateLabor * 100)}%, utilidad ${Math.round(pricingRules.profitRate * 100)}%, IGV ${Math.round(pricingRules.igvRate * 100)}%.`}
            >
              <Settings2 className="size-3.5" />
              Costo/hora: S/ {Number(hourlyCost || 0).toFixed(2)}{" "}
              <span className="text-muted-foreground">·</span>{" "}
              Comisión {Math.round(pricingRules.commissionRate * 100)}%
            </Button>
            <Button size="sm" className="w-full gap-1.5 text-xs sm:w-auto" onClick={handleNew}>
              <Plus className="size-3.5" />
              Nueva cotización
            </Button>
          </div>
        }
        mobileCard={(row) => {
          const q = row.original;
          const status = q.status ?? "DRAFT";
          return (
            <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold">{q.quotationNumber}</div>
                  <div className="mt-1 truncate text-sm font-semibold">{q.client_name ?? "—"}</div>
                </div>
                <Badge variant="outline" className={`shrink-0 border text-[10px] font-bold ${STATUS_STYLES[status] ?? ""}`}>
                  {STATUS_LABELS[status] ?? status}
                </Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div><dt className="text-muted-foreground">Sede</dt><dd className="truncate font-medium">{q.cost_center_name ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Emisión</dt><dd className="font-medium">{formatDate(q.issueDate)}</dd></div>
                <div><dt className="text-muted-foreground">Asesor</dt><dd className="truncate font-medium">{q.advisor_name ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Líneas</dt><dd className="font-medium">{q.lineCount}</dd></div>
              </dl>
              <div className="mt-3 flex min-w-0 items-center justify-between gap-3 overflow-hidden border-t border-border pt-3">
                <span className="flex items-center gap-1 text-xs font-semibold">Total <span title="Precio final de la cotización"><Info className="size-3.5 text-muted-foreground" /></span></span>
                <span className="shrink-0 whitespace-nowrap text-right text-base font-bold">{money(q.total)}</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1 border-t border-border pt-3">
                <Button variant="ghost" size="sm" className="h-11 min-w-11 p-3 text-muted-foreground" aria-label="Ver detalle" onClick={() => handleView(q.id)}><Eye className="size-4" /></Button>
                <Button variant="ghost" size="sm" className="h-11 min-w-11 p-3 text-muted-foreground" aria-label="Editar" onClick={() => handleEdit(q.id)}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="sm" className="h-11 min-w-11 p-3 text-muted-foreground" aria-label="Descargar PDF" disabled={isPending} onClick={() => handleDownload(q)}><Download className="size-4" /></Button>
                <Button variant="ghost" size="sm" className="h-11 min-w-11 p-3 text-muted-foreground hover:text-destructive" aria-label="Eliminar" onClick={() => handleDelete(q)}><Trash2 className="size-4" /></Button>
              </div>
            </article>
          );
        }}
      />

      <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
        <AlertTriangle className="size-3.5 text-amber-500" />
        <span>
          El precio de venta se calcula automáticamente (materiales + mano de obra +{" "}
          {Math.round(pricingRules.overheadRateQuote * 100)}% gastos generales +{" "}
          {Math.round(pricingRules.commissionRate * 100)}% comisión +{" "}
          {Math.round(pricingRules.profitRate * 100)}% margen +{" "}
          {Math.round(pricingRules.igvRate * 100)}% IGV).
        </span>
        <button
          type="button"
          onClick={() => {
            setConfigSession((s) => s + 1);
            setConfigOpen(true);
          }}
          className="text-[11px] font-semibold text-[#0066CC] hover:underline"
        >
          Ajustar configuración
        </button>
      </div>

      <QuotationCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
        editingDetail={editingDetail}
        options={options}
        defaultHourlyCost={hourlyCost}
        currentUser={currentUser}
      />

      <QuotationDetailDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        detail={viewingDetail}
        onStatusChange={handleStatusChange}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar cotización</DialogTitle>
            <DialogDescription>
              ¿Deseas eliminar la cotización <strong>{deleteTarget?.quotationNumber}</strong>?
              También se eliminará el PDF almacenado en Cloudflare. Esta acción no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>
              {isPending ? "Eliminando..." : "Eliminar cotización"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PricingConfigDialog
        key={configSession}
        open={configOpen}
        onOpenChange={setConfigOpen}
        currentRules={pricingRules}
        hourlyCost={hourlyCost}
        onSaved={(next, nextHourly) => {
          setPricingRules(next);
          setHourlyCost(nextHourly);
          refresh();
        }}
      />
    </div>
  );
}
