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
import { getQuotationPdfDataUrl } from "../quotation-pdf-actions";
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
  Timer,
  Trash2,
} from "lucide-react";
import { QuotationCreateDialog } from "./quotation-create-dialog";
import { QuotationDetailDialog } from "./quotation-detail-dialog";
import { LaborConfigDialog } from "./labor-config-dialog";

interface QuotationsTableProps {
  initialQuotations: QuotationWithRelations[];
  options: QuotationFormOptions;
  defaultHourlyCost: number;
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

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function QuotationsTable({
  initialQuotations,
  options,
  defaultHourlyCost,
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
      const res = await getQuotationPdfDataUrl(row.id);
      if ("dataUrl" in res && res.dataUrl) {
        downloadDataUrl(res.dataUrl, `Cotizacion_${row.quotationNumber}.pdf`);
      } else {
        toast.error("Error al generar el PDF", {
          description: "error" in res ? res.error : undefined,
        });
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
            >
              <Timer className="size-3.5" />
              Costo/hora: S/ {Number(hourlyCost || 0).toFixed(2)}
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
        El precio de venta se calcula automáticamente (materiales + mano de obra + 20% gastos
        generales + 4% comisión + 60% margen + 18% IGV).
      </div>

      <QuotationCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={refresh}
        editingDetail={editingDetail}
        options={options}
        defaultHourlyCost={hourlyCost}
      />

      <QuotationDetailDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        detail={viewingDetail}
        onStatusChange={handleStatusChange}
      />

      <LaborConfigDialog
        key={configSession}
        open={configOpen}
        onOpenChange={setConfigOpen}
        currentValue={hourlyCost}
        onSaved={(v) => {
          setHourlyCost(v);
          refresh();
        }}
      />
    </div>
  );
}