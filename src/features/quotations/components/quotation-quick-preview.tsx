"use client";

import type { QuotationDetail, QuotationWithRelations } from "../actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRight, Loader2, ScanSearch } from "lucide-react";

const money = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  });

interface QuotationQuickPreviewProps {
  /** Fila del listado: abre el popup y da el encabezado mientras carga el detalle. */
  quotation: QuotationWithRelations | null;
  /** Detalle con sus líneas; null mientras se consulta. */
  detail: QuotationDetail | null;
  onClose: () => void;
  onOpenDetail: (id: string) => void;
}

/**
 * Vista rápida de una cotización desde el listado: qué equipos y servicios
 * incluye, con su descripción y precio, sin entrar al detalle.
 */
export function QuotationQuickPreview({
  quotation,
  detail,
  onClose,
  onOpenDetail,
}: QuotationQuickPreviewProps) {
  const lines = detail?.lines ?? [];

  return (
    <Dialog open={!!quotation} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-[560px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8 text-base font-bold">
            <ScanSearch className="size-4 text-[#0066CC]" />
            Cotización {quotation?.quotationNumber}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {[quotation?.client_name, quotation?.cost_center_name].filter(Boolean).join(" · ") ||
              "Sin cliente"}
          </DialogDescription>
        </DialogHeader>

        {!detail ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando equipos y servicios...
          </div>
        ) : lines.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            Esta cotización aún no tiene equipos ni servicios.
          </div>
        ) : (
          <ol className="min-w-0 divide-y divide-border rounded-lg border border-border">
            {lines.map((line, index) => {
              const equipment = [line.elevator_internal_code, line.elevator_name]
                .filter(Boolean)
                .join(" — ");
              const discount = Number(line.lineDiscountAmount) || 0;
              return (
                <li key={line.id} className="flex items-start gap-3 p-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                  {/* El precio solo comparte fila con el nombre: el tipo de servicio y la
                      descripción usan todo el ancho, que en móvil es poco. */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words text-xs font-semibold">
                        {equipment || "Servicio general"}
                      </span>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-bold">{money(line.clientPrice)}</div>
                        {discount > 0 ? (
                          <div className="text-[10px] text-muted-foreground line-through">
                            {money((line.clientPrice ?? 0) + discount)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {line.service_type_name ? (
                      <Badge
                        variant="outline"
                        className="h-auto max-w-full shrink whitespace-normal rounded-md border-sky-500/30 bg-sky-500/10 py-1 text-left text-[10px] font-semibold leading-tight text-sky-700 dark:text-sky-400"
                      >
                        {line.service_type_name}
                      </Badge>
                    ) : null}
                    <p className="line-clamp-3 whitespace-pre-line break-words text-xs text-muted-foreground">
                      {line.description?.trim() || "Sin descripción"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <DialogFooter className="flex-row items-center justify-between gap-3 sm:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Total con IGV
            </div>
            <div className="text-sm font-bold text-foreground">
              {money(detail?.total ?? quotation?.total)}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0 gap-1.5 text-xs"
            disabled={!quotation}
            onClick={() => quotation && onOpenDetail(quotation.id)}
          >
            Abrir detalle
            <ArrowRight className="size-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
