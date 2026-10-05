"use client";

import { useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { cn } from "cn";
import { type TechnicianElevatorPhoto } from "../server/queries";

const TAG_SECTIONS: Array<{ tag: string; label: string }> = [
  { tag: "BEFORE", label: "Antes" },
  { tag: "AFTER", label: "Después" },
  { tag: "POINT", label: "Puntuales" },
];

export function PhotoGallery({
  photos,
  onRemove,
}: {
  photos: TechnicianElevatorPhoto[];
  onRemove: (id: string) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (photos.length === 0) return null;

  function handleDelete(photo: TechnicianElevatorPhoto) {
    if (confirmId === photo.id) {
      setConfirmId(null);
      onRemove(photo.id);
    } else {
      setConfirmId(photo.id);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Camera className="size-3.5" />
        Evidencia fotográfica ({photos.length})
      </div>
      {TAG_SECTIONS.map(({ tag, label }) => {
        const group = photos.filter((p) => p.tag === tag);
        if (group.length === 0) return null;
        return (
          <div key={tag}>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
              {label} ({group.length})
            </p>
            <div className="grid grid-cols-3 gap-2">
              {group.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.description ?? label}
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    type="button"
                    title={confirmId === photo.id ? "Confirmar eliminación" : "Eliminar foto"}
                    onClick={() => handleDelete(photo)}
                    className={cn(
                      "absolute right-1 top-1 rounded-full p-1 text-white transition-colors",
                      confirmId === photo.id
                        ? "bg-red-600"
                        : "bg-black/60 hover:bg-red-600"
                    )}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {confirmId && (
        <p className="text-[11px] text-muted-foreground">
          Toca el icono rojo de nuevo para confirmar la eliminación.
        </p>
      )}
    </div>
  );
}
