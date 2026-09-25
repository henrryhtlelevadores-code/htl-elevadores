"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { upsertLaborConfig } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Save, Timer } from "lucide-react";

interface LaborConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (value: number) => void;
  currentValue: number;
}

export function LaborConfigDialog({
  open,
  onOpenChange,
  onSaved,
  currentValue,
}: LaborConfigDialogProps) {
  const [value, setValue] = useState(String(currentValue || ""));
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const cost = Number(value);
    if (!Number.isFinite(cost) || cost < 0) {
      toast.error("Ingresa un costo por hora válido");
      return;
    }
    startTransition(async () => {
      const res = await upsertLaborConfig(cost);
      if (res.success) {
        toast.success(res.message);
        onSaved?.(cost);
        onOpenChange(false);
      } else {
        toast.error("Error al guardar", { description: res.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[420px] text-foreground shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Timer className="size-4 text-[#0066CC]" />
            Costo de mano de obra
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Costo por hora hombre aplicado por defecto en las cotizaciones (Soles/hora).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-xs font-semibold">Costo por hora (S/)</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="bg-background border-border text-sm"
            placeholder="Ej: 25.00"
          />
        </div>

        <DialogFooter className="pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending} className="text-xs gap-2">
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}