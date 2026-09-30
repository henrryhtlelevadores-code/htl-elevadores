"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { runSync } from "../lib/sync-client";
import { fileToCompressedDataUrl } from "../lib/media";
import { cn } from "cn";

const TAGS = [
  { value: "BEFORE", label: "Antes de la intervención" },
  { value: "AFTER", label: "Después de la intervención" },
  { value: "POINT", label: "Foto puntual" },
] as const;

export function PhotoModal({
  onClose,
  elevatorId,
  taskId,
}: {
  onClose: () => void;
  elevatorId: string;
  taskId?: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tag, setTag] = useState<string>("BEFORE");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  function pickFrom(kind: "camera" | "gallery") {
    const input = fileRef.current;
    if (!input) return;
    if (kind === "camera") {
      input.setAttribute("capture", "environment");
    } else {
      input.removeAttribute("capture");
    }
    input.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const { dataUrl } = await fileToCompressedDataUrl(file, 1600, 0.82);
      const res = await runSync("addElevatorPhoto", {
        elevatorId,
        taskId,
        tag,
        description,
        dataUrl,
      });
      if (res.success) {
        toast.success(res.message);
        onClose();
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "No se pudo subir la foto.",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !uploading && onClose()}>
      <DialogContent className="bg-card border-border sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Camera className="size-4 text-[#0066CC]" />
            Agregar foto
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Clasifica la foto y añade una descripción si lo necesitas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tipo de foto
            </label>
            <div className="mt-1.5 grid gap-2">
              {TAGS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTag(option.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    tag === option.value
                      ? "border-[#0066CC]/40 bg-[#0066CC]/10 text-[#0066CC] font-semibold"
                      : "border-border bg-background text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="photo-description"
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Descripción (opcional)
            </label>
            <textarea
              id="photo-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Qué muestra la foto..."
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
            />
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />

          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1 min-h-[48px] font-bold"
              onClick={() => pickFrom("camera")}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              {uploading ? "Subiendo..." : "Tomar foto"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 min-h-[48px] font-bold"
              onClick={() => pickFrom("gallery")}
              disabled={uploading}
            >
              <ImagePlus className="size-4" />
              Galería
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            className="w-full min-h-[44px]"
            onClick={onClose}
            disabled={uploading}
          >
            <X className="size-4" />
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}