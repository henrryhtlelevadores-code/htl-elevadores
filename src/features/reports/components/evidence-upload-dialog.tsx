"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fileToCompressedDataUrl } from "@/features/technician/lib/media";
import { cn } from "cn";
import { addEvidencePhotos, type EvidenceTag } from "../actions";

const TAGS: Array<{ value: EvidenceTag; label: string; hint: string }> = [
  { value: "BEFORE", label: "Antes", hint: "Estado previo a la intervención" },
  { value: "AFTER", label: "Después", hint: "Resultado de la intervención" },
  { value: "POINT", label: "Puntual", hint: "Detalle o incidencia concreta" },
];

const MAX_PHOTOS_PER_ELEVATOR = 10;

export function EvidenceUploadDialog({
  open,
  onOpenChange,
  workOrderId,
  elevatorId,
  elevatorLabel,
  remaining,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string;
  elevatorId: string;
  elevatorLabel: string;
  remaining: number;
  onUploaded: (urls: string[], tag: EvidenceTag) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tag, setTag] = useState<EvidenceTag>("BEFORE");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  function pickFiles() {
    fileRef.current?.click();
  }

  function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;
    const allowed = Math.max(0, Math.min(4, remaining));
    if (selected.length > allowed) {
      toast.info(`Se subirán ${allowed} foto(s)`, {
        description: `Máximo ${allowed} en este lote por el límite de ${MAX_PHOTOS_PER_ELEVATOR} fotos por equipo.`,
      });
    }
    setFiles(selected.slice(0, allowed));
  }

  async function handleUpload() {
    if (files.length === 0 || uploading) return;
    setUploading(true);
    try {
      const images = await Promise.all(
        files.map((file) => fileToCompressedDataUrl(file))
      );
      const result = await addEvidencePhotos(workOrderId, elevatorId, images, tag);
      if (result.success && result.urls) {
        toast.success(result.message);
        onUploaded(result.urls, tag);
        onOpenChange(false);
      } else {
        toast.error("Error", { description: result.error });
      }
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "No se pudieron subir las fotos.",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !uploading && onOpenChange(next)}>
      <DialogContent className="bg-card border-border sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Camera className="size-4 text-[#0066CC]" />
            Agregar evidencias
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {elevatorLabel}. Clasifica las fotos antes de subirlas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tipo de foto
            </label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {TAGS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTag(option.value)}
                  disabled={uploading}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-left transition-colors",
                    tag === option.value
                      ? "border-[#0066CC]/40 bg-[#0066CC]/10 text-[#0066CC]"
                      : "border-border bg-background text-foreground hover:bg-muted/40"
                  )}
                >
                  <span className="block text-xs font-semibold">{option.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFiles}
            />
            <button
              type="button"
              onClick={pickFiles}
              disabled={uploading || remaining <= 0}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-xs text-muted-foreground transition-colors hover:border-[#0066CC]/50 hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ImagePlus className="size-5" />
              {remaining <= 0
                ? "Límite de fotos alcanzado"
                : files.length > 0
                  ? `${files.length} foto(s) seleccionada(s)`
                  : "Seleccionar imágenes"}
            </button>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Puedes subir hasta 4 por lote. Quedan {Math.max(0, remaining)} de{" "}
              {MAX_PHOTOS_PER_ELEVATOR} en este equipo.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Camera className="size-4" />
            )}
            {uploading ? "Subiendo..." : `Subir ${files.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
