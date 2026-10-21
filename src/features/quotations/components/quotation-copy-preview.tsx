"use client";

import type { QuotationDetail } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ImageIcon, Loader2, TriangleAlert, X } from "lucide-react";

export interface QuotationCopyImage {
  id: string;
  url: string;
  caption: string | null;
}

interface QuotationCopyPreviewProps {
  quotation: QuotationDetail;
  images: QuotationCopyImage[];
  targetCostCenterId: string;
  onClear: () => void;
}

const money = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  });

const formatDate = (ts: number | null | undefined) =>
  ts ? new Date(ts * 1000).toLocaleDateString("es-PE") : "Sin fecha";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  ACCEPTED: "Aceptada",
  REJECTED: "Rechazada",
};

/**
 * Vista previa de la cotización que se va a copiar. Muestra lo suficiente
 * para detectar una selección equivocada antes de crear la nueva cotización:
 * sede de origen, líneas, importes, descuentos e imágenes.
 */
export function QuotationCopyPreview({
  quotation,
  images,
  targetCostCenterId,
  onClear,
}: QuotationCopyPreviewProps) {
  const lineDiscounts = quotation.lines.reduce(
    (sum, line) => sum + (Number(line.lineDiscountAmount) || 0),
    0
  );
  const differentCostCenter =
    Boolean(targetCostCenterId) &&
    Boolean(quotation.costCenterId) &&
    targetCostCenterId !== quotation.costCenterId;

  return (
    <div className="rounded-lg border border-[#0066CC]/30 bg-[#0066CC]/5">
      <div className="flex items-start justify-between gap-3 border-b border-[#0066CC]/20 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Copy className="size-3.5 shrink-0 text-[#0066CC]" />
            <span className="truncate">Se copiará {quotation.quotationNumber}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {[quotation.client_name, quotation.cost_center_name]
              .filter(Boolean)
              .join(" · ") || "Sin cliente"}
          </p>
        </div>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          onClick={onClear}
          aria-label="Quitar cotización seleccionada"
        >
          <X />
        </Button>
      </div>

      <div className="space-y-3 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Estado</div>
            <div className="text-xs font-semibold">
              {STATUS_LABELS[quotation.status ?? ""] ?? quotation.status ?? "Borrador"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Emitida</div>
            <div className="text-xs font-semibold">{formatDate(quotation.issueDate)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Líneas</div>
            <div className="text-xs font-semibold">{quotation.lines.length}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Total con IGV
            </div>
            <div className="text-xs font-bold">{money(quotation.total)}</div>
          </div>
        </div>

        {quotation.lines.length > 0 ? (
          <ol className="max-h-40 divide-y divide-border overflow-y-auto rounded-md border border-border bg-background">
            {quotation.lines.map((line, index) => {
              const equipment = [line.elevator_internal_code, line.elevator_name]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={line.id} className="flex items-start gap-2 px-2.5 py-2">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-semibold">
                          {equipment || "Servicio general"}
                        </div>
                        <div className="line-clamp-1 text-[10px] text-muted-foreground">
                          {[line.service_type_name, line.description?.trim()]
                            .filter(Boolean)
                            .join(" · ") || "Sin descripción"}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] font-semibold">{money(line.clientPrice)}</div>
                        {Number(line.lineDiscountAmount) > 0 ? (
                          <div className="text-[9px] text-muted-foreground">
                            Desc. {money(line.lineDiscountAmount)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="rounded-md border border-dashed border-border bg-background px-3 py-4 text-center text-[11px] text-muted-foreground">
            Esta cotización no tiene líneas. Se copiarán solo sus mensajes y condiciones.
          </div>
        )}

        {images.length > 0 ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {images.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image.id}
                src={image.url}
                alt={image.caption ?? "Imagen referencial"}
                className="size-12 shrink-0 rounded-md border border-border object-cover"
              />
            ))}
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {images.length} {images.length === 1 ? "imagen" : "imágenes"}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <ImageIcon className="size-3" />
            Sin imágenes referenciales
          </div>
        )}

        {differentCostCenter ? (
          <div className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-800 dark:text-amber-300">
            <TriangleAlert className="mt-0.5 size-3 shrink-0" />
            <span>
              La cotización original pertenece a otra sede. Sus equipos se copiarán tal cual;
              revisa el alcance en la nueva cotización.
            </span>
          </div>
        ) : null}

        <p className="text-[10px] text-muted-foreground">
          Se copiarán también los mensajes, condiciones comerciales, productos y descuentos.
          {lineDiscounts > 0 || Number(quotation.discountAmount) > 0
            ? ` Descuentos incluidos: ${money(lineDiscounts + (Number(quotation.discountAmount) || 0))}.`
            : ""}
        </p>
      </div>
    </div>
  );
}

export function QuotationCopyPreviewLoading() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 py-5 text-[11px] text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" />
      Cargando la cotización a copiar...
    </div>
  );
}

export function QuotationCopyHint() {
  return (
    <Badge
      variant="outline"
      className="h-auto rounded-md border-sky-500/30 bg-sky-500/10 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-400"
    >
      Copia exacta
    </Badge>
  );
}
