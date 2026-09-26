"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
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
  AlertTriangle,
  Calculator,
  Download,
  Eye,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { QuotationCreateDialog } from "./quotation-create-dialog";
import { QuotationDetailDialog } from "./quotation-detail-dialog";
import { PricingConfigDialog } from "./pricing-config-dialog";

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
    const detail = await getQuotationById(id);
    setViewingDetail(detail);
    setViewOpen(true);
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

  async function handleDelete(row: QuotationWithRelations) {
    if (
      !window.confirm(
        `¿Eliminar la cotización ${row.quotationNumber}? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
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
        cell: ({ row }) => (
          <span className="font-mono font-semibold text-xs">{row.original.quotationNumber}</span>
        ),
      },
      {
        accessorKey: "client_name",
        header: "Cliente",
        cell: ({ row }) => (
          <span className="text-xs font-medium">{row.original.client_name ?? "—"}</span>
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
          <span className="text-xs font-bold">{money(row.original.total)}</span>
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
            <Button
              variant="ghost"
              size="sm"
              className="size-7 h-7 text-muted-foreground hover:text-foreground"
              title="Ver detalle"
              onClick={() => handleView(row.original.id)}
            >
              <Eye className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 h-7 text-muted-foreground hover:text-foreground"
              title="Editar"
              onClick={() => handleEdit(row.original.id)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 h-7 text-muted-foreground hover:text-foreground"
              title="Descargar PDF"
              disabled={isPending}
              onClick={() => handleDownload(row.original)}
            >
              <Download className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 h-7 text-muted-foreground hover:text-destructive"
              title="Eliminar"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="size-3.5" />
            </Button>
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
        searchKey="quotationNumber"
        emptyState={
          <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Calculator className="size-8 text-muted-foreground/40" />
            No hay cotizaciones registradas. Crea la primera para comenzar.
          </div>
        }
        extraActions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
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
            <Button size="sm" className="text-xs gap-1.5" onClick={handleNew}>
              <Plus className="size-3.5" />
              Nueva cotización
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
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
