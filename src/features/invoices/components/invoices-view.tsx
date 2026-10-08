"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type InvoiceListItem,
  type InvoiceItemDetail,
  type InvoiceFormData,
  getInvoiceItems,
  updateInvoiceStatus,
} from "../actions";
import {
  PAYER_RELATIONSHIP_LABELS,
  PAYER_TAX_ID_TYPE_LABELS,
  PAYMENT_STATUS,
  SUNAT_STATUS,
} from "../schema";
import { InvoiceCreateDialog } from "./invoice-create-dialog";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  Building2,
  ChevronLeft,
  FileText,
  Loader2,
  MapPin,
  Plus,
  ReceiptText,
  User,
} from "lucide-react";

interface InvoicesViewProps {
  invoices: InvoiceListItem[];
  clients: Array<{ id: string; legalName: string }>;
  costCenters: Array<{
    id: string;
    name: string;
    clientId: string;
    client_name: string;
  }>;
  formData: InvoiceFormData;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  FACTURA: "Factura",
  BOLETA: "Boleta",
  NOTA_VENTA_INTERNA: "Nota de Venta Interna",
};

const SUNAT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  SUNAT_STATUS.map((s) => [s.value, s.label])
);

const PAYMENT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  PAYMENT_STATUS.map((s) => [s.value, s.label])
);

function formatAmount(currency: string | null, amount: number | null): string {
  const value = amount ?? 0;
  return `${currency || "PEN"} ${value.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
  })}`;
}

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SunatBadge({ status }: { status: string | null }) {
  const value = status ?? "DRAFT";
  const classes =
    value === "ACCEPTED"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      : value === "REJECTED" || value === "CANCELLED"
        ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
        : value === "ISSUED"
          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
          : "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cn("border text-[10px] font-bold", classes)}>
      {SUNAT_STATUS_LABELS[value] ?? value}
    </Badge>
  );
}

function PaymentBadge({ status }: { status: string | null }) {
  const value = status ?? "PENDING";
  const classes =
    value === "PAID"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      : value === "OVERDUE"
        ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
        : value === "PARTIAL"
          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
  return (
    <Badge variant="outline" className={cn("border text-[10px] font-bold", classes)}>
      {PAYMENT_STATUS_LABELS[value] ?? value}
    </Badge>
  );
}

function InfoChip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-xs font-bold truncate">{value}</div>
    </div>
  );
}

function isThirdPartyPayer(invoice: InvoiceListItem) {
  return invoice.payerType === "THIRD_PARTY";
}

function PayerBadge({ invoice }: { invoice: InvoiceListItem }) {
  if (isThirdPartyPayer(invoice)) {
    return (
      <Badge
        variant="outline"
        className="border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold gap-1"
      >
        <User className="size-3" />
        Pagador: tercero
      </Badge>
    );
  }
  return (
    <span className="text-[11px] text-muted-foreground">Centro de costos</span>
  );
}

function PayerBlock({ invoice }: { invoice: InvoiceListItem }) {
  if (!isThirdPartyPayer(invoice)) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <User className="size-3.5" />
          Pagador
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Paga el centro de costos{" "}
          <strong className="text-foreground">
            {invoice.cost_center_name ?? "—"}
          </strong>
          . El comprobante se emite a nombre de {invoice.client_name}
          {invoice.clientTaxIdSnapshot ? ` (${invoice.clientTaxIdSnapshot})` : ""}.
        </p>
      </div>
    );
  }

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    {
      label: invoice.payerTaxIdType
        ? (PAYER_TAX_ID_TYPE_LABELS[invoice.payerTaxIdType] ?? invoice.payerTaxIdType)
        : "Documento",
      value: invoice.payerTaxId ?? "—",
    },
    {
      label: "Relación",
      value: invoice.payerRelationship
        ? (PAYER_RELATIONSHIP_LABELS[invoice.payerRelationship] ?? invoice.payerRelationship)
        : "—",
    },
  ];

  if (invoice.payerCommercialName) {
    rows.push({ label: "Nombre comercial", value: invoice.payerCommercialName });
  }
  if (invoice.payerPhone) rows.push({ label: "Teléfono", value: invoice.payerPhone });
  if (invoice.payerEmail) rows.push({ label: "Correo", value: invoice.payerEmail });

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <User className="size-3.5" />
        Pagador
      </div>
      <div className="flex items-center gap-1.5 text-sm font-bold text-amber-700 dark:text-amber-400">
        <User className="size-3.5" />
        Tercero: {invoice.payerName ?? "—"}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {rows.map((row) => (
          <InfoChip key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
      {invoice.payerNotes && (
        <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Notas
          </div>
          <div className="text-xs">{invoice.payerNotes}</div>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground leading-snug">
        El comprobante fiscal se emitió a nombre de {invoice.client_name}
        {invoice.clientTaxIdSnapshot ? ` (${invoice.clientTaxIdSnapshot})` : ""}. El pagador es
        solo referencial y no altera los datos fiscales del comprobante.
      </p>
    </div>
  );
}

export function InvoicesView({ invoices, clients, costCenters, formData }: InvoicesViewProps) {
  const router = useRouter();
  const [clientFilter, setClientFilter] = useState("");
  const [ccFilter, setCcFilter] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [itemsByInvoice, setItemsByInvoice] = useState<Record<string, InvoiceItemDetail[]>>({});
  const [loadingItems, setLoadingItems] = useState(false);
  // Estado local mientras se guarda: el diálogo se alimenta de `invoices`, que
  // solo se actualiza con router.refresh(), así que sin esto el Select
  // "rebotaría" al valor viejo apenas el usuario elige.
  const [statusDraft, setStatusDraft] = useState<{
    sunatStatus: string;
    paymentStatus: string;
  } | null>(null);
  const [savingStatus, startStatusTransition] = useTransition();

  const closeDetail = useCallback(() => {
    setViewingId(null);
    setStatusDraft(null);
  }, []);

  const filteredCostCenters = useMemo(
    () =>
      clientFilter
        ? costCenters.filter((cc) => cc.clientId === clientFilter)
        : costCenters,
    [clientFilter, costCenters]
  );

  const filteredInvoices = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          (!clientFilter || inv.clientId === clientFilter) &&
          (!ccFilter || inv.costCenterId === ccFilter)
      ),
    [invoices, clientFilter, ccFilter]
  );

  const viewing = useMemo(
    () => invoices.find((inv) => inv.id === viewingId) ?? null,
    [invoices, viewingId]
  );

  const viewingItems = useMemo(
    () => (viewingId ? itemsByInvoice[viewingId] ?? [] : []),
    [viewingId, itemsByInvoice]
  );

  const handleOpen = useCallback(
    async (invoice: InvoiceListItem) => {
      setViewingId(invoice.id);
      setStatusDraft(null);
      if (itemsByInvoice[invoice.id]) return;
      setLoadingItems(true);
      try {
        const items = await getInvoiceItems(invoice.id);
        setItemsByInvoice((prev) => ({ ...prev, [invoice.id]: items }));
      } catch (error) {
        setItemsByInvoice((prev) => ({ ...prev, [invoice.id]: [] }));
        toast.error("Error", {
          description:
            error instanceof Error ? error.message : "No se pudieron cargar los conceptos.",
        });
      } finally {
        setLoadingItems(false);
      }
    },
    [itemsByInvoice]
  );

  const documentLabel = viewing
    ? DOCUMENT_TYPE_LABELS[viewing.documentType] ?? viewing.documentType
    : "";

  const currentSunatStatus = statusDraft?.sunatStatus ?? viewing?.sunatStatus ?? "DRAFT";
  const currentPaymentStatus = statusDraft?.paymentStatus ?? viewing?.paymentStatus ?? "PENDING";

  const handleStatusChange = useCallback(
    (field: "sunatStatus" | "paymentStatus", value: string) => {
      if (!viewing) return;
      const next = {
        sunatStatus: field === "sunatStatus" ? value : currentSunatStatus,
        paymentStatus: field === "paymentStatus" ? value : currentPaymentStatus,
      };
      setStatusDraft(next);
      startStatusTransition(async () => {
        const res = await updateInvoiceStatus(viewing.id, next);
        if (res.success) {
          toast.success("Estados actualizados", {
            description: `${SUNAT_STATUS_LABELS[next.sunatStatus]} · ${
              PAYMENT_STATUS_LABELS[next.paymentStatus]
            }`,
          });
          setStatusDraft(null);
          router.refresh();
        } else {
          setStatusDraft(null);
          toast.error("Error", { description: res.error });
        }
      });
    },
    [viewing, currentSunatStatus, currentPaymentStatus, router]
  );

  const columns = useMemo<ColumnDef<InvoiceListItem>[]>(
    () => [
      {
        accessorKey: "series",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-xs font-semibold hover:bg-muted/60"
          >
            Comprobante
            <ArrowUpDown className="ml-1.5 size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => {
          const inv = row.original;
          return inv.number ? (
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border border-border">
              {inv.series}-{inv.number}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">Borrador</span>
          );
        },
      },
      {
        accessorKey: "documentType",
        header: "Tipo",
        cell: ({ row }) => {
          const docType = row.getValue<string>("documentType");
          return (
            <span className="text-xs text-muted-foreground">
              {DOCUMENT_TYPE_LABELS[docType] ?? docType}
            </span>
          );
        },
      },
      {
        accessorKey: "client_name",
        header: "Cliente",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-xs text-foreground max-w-[180px]">
            <Building2 className="size-3.5 text-[#0066CC] shrink-0" />
            <span className="truncate font-semibold">{row.getValue("client_name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "cost_center_name",
        header: "Centro de Costo",
        cell: ({ row }) => {
          const name = row.getValue<string | null>("cost_center_name");
          return name ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground max-w-[160px]">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{name}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/50">—</span>
          );
        },
      },
      {
        accessorKey: "otNumber",
        header: "OT",
        cell: ({ row }) => {
          const ot = row.getValue<string | null>("otNumber");
          return ot ? (
            <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-muted border border-border">
              {ot}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50">—</span>
          );
        },
      },
      {
        accessorKey: "issueDate",
        header: "Emisión",
        cell: ({ row }) => (
          <span className="text-xs font-mono text-muted-foreground">
            {formatDate(row.getValue<number | null>("issueDate"))}
          </span>
        ),
      },
      {
        accessorKey: "total",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 text-xs font-semibold hover:bg-muted/60"
          >
            Total
            <ArrowUpDown className="ml-1.5 size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-xs font-bold tabular-nums whitespace-nowrap">
            {formatAmount(row.original.currency, row.getValue("total"))}
          </span>
        ),
      },
      {
        accessorKey: "sunatStatus",
        header: "SUNAT",
        cell: ({ row }) => <SunatBadge status={row.getValue("sunatStatus")} />,
      },
      {
        accessorKey: "paymentStatus",
        header: "Pago",
        cell: ({ row }) => <PaymentBadge status={row.getValue("paymentStatus")} />,
      },
      {
        id: "payer",
        header: "Pagador",
        cell: ({ row }) => <PayerBadge invoice={row.original} />,
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="xs"
              onClick={() => handleOpen(row.original)}
              className="h-7 px-2.5 text-xs font-semibold text-[#0066CC] dark:text-blue-400 border-[#0066CC]/30 hover:bg-[#0066CC]/10 gap-1.5 shadow-2xs"
            >
              <ReceiptText className="size-3" />
              Ver
            </Button>
          </div>
        ),
      },
    ],
    [handleOpen]
  );

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Filtrar:
        </span>
        <SearchableSelect
          items={clients}
          value={clientFilter}
          onValueChange={(v) => {
            setClientFilter(v);
            setCcFilter("");
          }}
          getValue={(c) => c.id}
          getLabel={(c) => c.legalName}
          placeholder="Todos los clientes"
          searchPlaceholder="Buscar cliente..."
          emptyText="No hay clientes registrados"
          allowClear
          clearLabel="Todos los clientes"
          className="h-7 sm:w-[220px]"
        />

        <SearchableSelect
          items={filteredCostCenters}
          value={ccFilter}
          onValueChange={(v) => setCcFilter(v)}
          getValue={(cc) => cc.id}
          getLabel={(cc) => cc.name}
          getKeywords={(cc) => cc.client_name}
          placeholder="Todos los centros de costo"
          searchPlaceholder="Buscar centro de costo..."
          emptyText="No hay centros de costo para este cliente"
          allowClear
          clearLabel="Todos los centros de costo"
          className="h-7 sm:w-[220px]"
        />
      </div>

      <DataTable
        columns={columns}
        data={filteredInvoices}
        searchPlaceholder="Buscar por comprobante, cliente o OT..."
        extraActions={
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs shrink-0"
          >
            <Plus className="size-4" />
            Nueva Factura
          </Button>
        }
      />

      <InvoiceCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={() => router.refresh()}
        clients={clients}
        costCenters={costCenters}
        formData={formData}
      />

      {/* Dialog: Detalle de factura */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100%-1rem)] max-w-[840px] max-h-[calc(100dvh-1rem)] overflow-y-auto overscroll-contain bg-card p-3 text-foreground shadow-lg sm:max-h-[92dvh] sm:p-4"
        >
          <button
            onClick={closeDetail}
            className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-3" />
            Cerrar
          </button>

          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-col items-start gap-2 pr-16 text-base font-bold sm:flex-row sm:items-center sm:pr-24">
                  <span className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                    <ReceiptText className="size-4 shrink-0 text-[#0066CC]" />
                    <span className="break-words">{documentLabel}</span>
                    {viewing.number && (
                      <span className="break-all font-mono text-sm text-foreground">
                        {viewing.series}-{viewing.number}
                      </span>
                    )}
                  </span>
                  <span className="flex max-w-full flex-wrap items-center gap-1.5">
                    {!viewing.number && (
                      <Badge
                        variant="outline"
                        className="border text-[10px] font-bold text-muted-foreground"
                      >
                        Borrador
                      </Badge>
                    )}
                    <SunatBadge status={currentSunatStatus} />
                    <PaymentBadge status={currentPaymentStatus} />
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {viewing.client_name}
                  {viewing.clientTaxIdSnapshot ? ` · ${viewing.clientTaxIdSnapshot}` : ""}
                </DialogDescription>
              </DialogHeader>

              {/* Estados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border bg-muted/20 p-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="invoice-sunat-status"
                    className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"
                  >
                    <SunatBadge status={currentSunatStatus} />
                    Estado SUNAT
                  </label>
                  <Select
                    value={currentSunatStatus}
                    onValueChange={(v) =>
                      v && handleStatusChange("sunatStatus", v)
                    }
                    disabled={savingStatus}
                  >
                    <SelectTrigger
                      id="invoice-sunat-status"
                      className="w-full h-8 bg-background border-border text-xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUNAT_STATUS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="invoice-payment-status"
                    className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5"
                  >
                    <PaymentBadge status={currentPaymentStatus} />
                    Estado del pago
                  </label>
                  <Select
                    value={currentPaymentStatus}
                    onValueChange={(v) =>
                      v && handleStatusChange("paymentStatus", v)
                    }
                    disabled={savingStatus}
                  >
                    <SelectTrigger
                      id="invoice-payment-status"
                      className="w-full h-8 bg-background border-border text-xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {savingStatus && (
                  <p className="sm:col-span-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Guardando el cambio de estado...
                  </p>
                )}
              </div>

              {/* Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                <InfoChip
                  label="Emisión"
                  value={viewing.issueDate ? formatDate(viewing.issueDate) : "—"}
                />
                <InfoChip
                  label="Vencimiento"
                  value={viewing.dueDate ? formatDate(viewing.dueDate) : "—"}
                />
                <InfoChip label="Periodo" value={viewing.taxPeriod ?? "—"} />
                <InfoChip label="Moneda" value={viewing.currency ?? "PEN"} />
                <InfoChip
                  label="Centro de Costo"
                  value={viewing.cost_center_name ?? "—"}
                />
                <InfoChip
                  label="OT"
                  value={
                    viewing.workOrderId
                      ? (viewing.otNumber ?? viewing.workOrderId)
                      : "—"
                  }
                />
              </div>

              {/* Montos */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <InfoChip
                  label="Base imponible"
                  value={formatAmount(viewing.currency, viewing.taxableBase)}
                />
                <InfoChip label="IGV" value={formatAmount(viewing.currency, viewing.igv)} />
                <InfoChip
                  label="Precio Total"
                  value={
                    <span className="text-sm font-extrabold text-[#0066CC] dark:text-blue-400">
                      {formatAmount(viewing.currency, viewing.total)}
                    </span>
                  }
                />
                {Number(viewing.detractionAmount) > 0 && (
                  <InfoChip
                    label="Detracción"
                    value={formatAmount(viewing.currency, viewing.detractionAmount)}
                  />
                )}
                {Number(viewing.rentaAmount) > 0 && (
                  <InfoChip
                    label="Renta"
                    value={formatAmount(viewing.currency, viewing.rentaAmount)}
                  />
                )}
                <InfoChip
                  label="Neto a pagar"
                  value={formatAmount(viewing.currency, viewing.netPayable)}
                />
              </div>

              {/* Pagador */}
              <PayerBlock invoice={viewing} />

              {/* Conceptos */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <FileText className="size-3.5" />
                  Conceptos ({viewing.itemCount})
                </div>
                {loadingItems ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Cargando conceptos...
                  </div>
                ) : viewingItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 py-8 text-center">
                    <ReceiptText className="size-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground font-semibold">
                      Esta factura no tiene conceptos registrados
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-xs">
                        <thead className="bg-muted/50 border-b border-border">
                          <tr>
                            <th className="text-left font-semibold text-muted-foreground px-3 py-2">
                              Descripción
                            </th>
                            <th className="text-right font-semibold text-muted-foreground px-3 py-2">
                              Cant.
                            </th>
                            <th className="text-right font-semibold text-muted-foreground px-3 py-2">
                              P. Unit.
                            </th>
                            <th className="text-right font-semibold text-muted-foreground px-3 py-2">
                              Importe
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewingItems.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b border-border last:border-0"
                            >
                              <td className="px-3 py-2 text-foreground font-medium max-w-[240px]">
                                <div className="truncate">{item.description}</div>
                                {item.serviceTypeName && (
                                  <div className="text-[10px] text-muted-foreground">
                                    {item.serviceTypeName}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                {item.quantity ?? 1}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                {item.unitPrice.toLocaleString("es-PE", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-bold text-foreground whitespace-nowrap">
                                {item.subtotal.toLocaleString("es-PE", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
