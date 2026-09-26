"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { QuotationDetail } from "../actions";
import { getQuotationPdfDataUrl } from "../quotation-pdf-actions";
import { QUOTATION_STATUS } from "../schema";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Loader2,
  CalendarDays,
  Download,
  FileText,
  MapPin,
  User,
} from "lucide-react";

interface QuotationDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: QuotationDetail | null;
  onStatusChange?: (id: string, status: string) => void;
}

const money = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  });

const formatDate = (ts: number | null | undefined) =>
  ts ? new Date(ts * 1000).toLocaleDateString("es-PE") : "—";

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

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

export function QuotationDetailDialog({
  open,
  onOpenChange,
  detail,
  onStatusChange,
}: QuotationDetailDialogProps) {
  const detailId = detail?.id ?? "";
  const [isPending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);

  function handleDownload() {
    if (!detail) return;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[860px] text-foreground shadow-lg max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <FileText className="size-4 text-[#0066CC]" />
            Cotización {detail?.quotationNumber}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Detalle y descarga del documento
          </DialogDescription>
        </DialogHeader>

        {detail ? (
          <div className="space-y-5 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                variant="outline"
                className={`border text-[10px] font-bold ${STATUS_STYLES[detail.status ?? "DRAFT"] ?? ""}`}
              >
                {STATUS_LABELS[detail.status ?? "DRAFT"] ?? detail.status}
              </Badge>
              <div className="text-xs text-muted-foreground">
                {detail.lines.length} línea(s) · Emitida{" "}
                {formatDate(detail.issueDate)}
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Estado:</span>
                <Select
                  value={detail.status ?? "DRAFT"}
                  onValueChange={(v) => onStatusChange?.(detailId, String(v ?? ""))}
                >
                  <SelectTrigger className="h-7 w-[140px] bg-background border-border text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTATION_STATUS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg border border-border bg-muted/20 p-4">
              <InfoItem icon={User} label="Cliente" value={detail.client_name ?? "—"} />
              <InfoItem icon={MapPin} label="Sede" value={detail.cost_center_name ?? "—"} />
              <InfoItem icon={User} label="Asesor" value={detail.advisor_name ?? "—"} />
              <InfoItem
                icon={CalendarDays}
                label="Válida hasta"
                value={formatDate(detail.validUntil)}
              />
            </div>

            <div className="space-y-3">
              {detail.lines.map((line, idx) => (
                <div key={line.id} className="rounded-lg border border-border overflow-hidden">
                  <div className="flex items-start justify-between gap-2 px-3 py-2 bg-muted/30 border-b border-border">
                    <div>
                      <div className="text-sm font-semibold">
                        {String(idx + 1).padStart(2, "0")}. {line.description}
                      </div>
                      {line.elevator_internal_code || line.elevator_name ? (
                        <div className="text-xs text-muted-foreground">
                          Equipo: {[line.elevator_internal_code, line.elevator_name].filter(Boolean).join(" — ")}
                        </div>
                      ) : null}
                      {line.lineMode === "MANUAL_PRICE" ? (
                        <div className="text-xs text-amber-700">
                          Precio manual
                          {line.lineModeReason ? ` — ${line.lineModeReason}` : ""}
                          {line.manualPrice != null
                            ? ` — S/ ${money(line.manualPrice)}${line.manualPriceIncludesIgv === false ? " sin IGV" : " c/IGV"}`
                            : ""}
                          {line.supplierName
                            ? ` — Proveedor: ${line.supplierName}${line.supplierCost != null ? ` (S/ ${money(line.supplierCost)})` : ""}`
                            : ""}
                        </div>
                      ) : line.lineOverridePrice != null ? (
                        <div className="text-xs text-amber-700">
                          Precio pactado — S/ {money(line.lineOverridePrice)} c/IGV
                          {line.lineOverrideReason ? ` — ${line.lineOverrideReason}` : ""}
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold">{money(line.clientPrice)}</div>
                      <div className="text-[10px] text-muted-foreground">precio venta (+IGV)</div>
                    </div>
                  </div>

                  {line.products.length > 0 ? (
                    <div className="px-3 py-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="py-1 font-medium">Descripción</th>
                            <th className="py-1 font-medium text-right">Cant.</th>
                            <th className="py-1 font-medium text-right">Und.</th>
                            <th className="py-1 font-medium text-right">C. Unit. (S/)</th>
                            <th className="py-1 font-medium text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {line.products.map((p, i) => (
                            <tr key={i} className="border-b border-border/60">
                              <td className="py-1">{p.description}</td>
                              <td className="py-1 text-right">{p.quantity}</td>
                              <td className="py-1 text-right text-muted-foreground">
                                {p.unit ?? "—"}
                              </td>
                              <td className="py-1 text-right">{money(p.unitCost)}</td>
                              <td className="py-1 text-right">{money(p.totalCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {line.lineMode === "MANUAL_PRICE" ? (
                    <div className="px-3 py-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Precio final</span>
                        <span className="font-medium">
                          {money(line.manualPrice ?? line.clientPrice)}{" "}
                          {line.manualPriceIncludesIgv === false ? "sin IGV" : "c/IGV"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {line.supplierName ? "Costo del proveedor" : "Tipo"}
                        </span>
                        <span className="font-medium">
                          {line.supplierName
                            ? money(line.supplierCost ?? 0)
                            : "Precio fijo"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor neto</span>
                        <span className="font-medium">{money(line.clientValue)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="px-3 py-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Materiales</span>
                        <span className="font-medium">{money(line.productCost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Mano de obra</span>
                        <span className="font-medium">
                          {money(line.laborCost)} ({line.totalHours ?? 0}h × {money(line.hourlyCost)})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gastos generales</span>
                        <span className="font-medium">
                          {money(line.overheadAmount)} ({(line.overheadRate ?? 0) * 100}%)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Comisión</span>
                        <span className="font-medium">
                          {money(line.commissionAmount)} ({(line.commissionRate ?? 0) * 100}%)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Margen</span>
                        <span className="font-medium">
                          {money(line.profitAmount)} ({(line.profitRate ?? 0) * 100}%)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor neto</span>
                        <span className="font-medium">{money(line.clientValue)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center mb-2">
                <div>
                  <div className="text-[10px] text-muted-foreground">Subtotal</div>
                  <div className="text-sm font-semibold">{money(detail.subtotal)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Descuento</div>
                  <div className="text-sm font-semibold">
                    {Number(detail.discountAmount ?? 0) > 0
                      ? `-${money(detail.discountAmount)}`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Base</div>
                  <div className="text-sm font-semibold">{money(detail.taxableBase)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">IGV 18%</div>
                  <div className="text-sm font-semibold">{money(detail.igv)}</div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-sm font-semibold flex items-center gap-1">
                  <DollarSign className="size-4" />
                  Total
                </span>
                <span className="text-base font-bold text-[#0066CC]">{money(detail.total)}</span>
              </div>
            </div>

            {detail.notes ? (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                  Notas
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detail.notes}</p>
              </div>
            ) : null}
            {detail.terms ? (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                  Condiciones
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detail.terms}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No se encontró la cotización
          </div>
        )}

        <DialogFooter className="pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
            Cerrar
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!detail || isPending || downloading}
            className="text-xs gap-2"
          >
            {downloading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Descargar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}