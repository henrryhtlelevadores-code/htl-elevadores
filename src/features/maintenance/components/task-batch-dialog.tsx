"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createMaintenanceTasksBatch } from "../actions";
import {
  maintenanceTaskBatchItemSchema,
  type MaintenanceTaskBatchItem,
} from "../schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Camera, ClipboardList, Loader2, ShieldAlert, Wand2 } from "lucide-react";

const inputClass =
  "bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]";

const SAMPLE_JSON = `[
  {
    "description": "Comprobar el estado de las poleas bajo la cabina",
    "isCritical": 0,
    "requiresPhoto": 0
  },
  {
    "description": "Comprobar el nivel de aceite del operador de puerta",
    "isCritical": 1,
    "requiresPhoto": 1
  }
]`;

type ParsedBatch = {
  items: MaintenanceTaskBatchItem[];
  error: string | null;
};

/**
 * Acepta los nombres de campo más comunes para que el JSON se pueda pegar
 * tal cual venga de una hoja de cálculo o de otro sistema.
 */
function readFlag(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }
  return undefined;
}

function readDescription(row: Record<string, unknown>) {
  const value =
    row.description ??
    row.descripcion ??
    row.detalle ??
    row.texto ??
    row.tarea;
  return typeof value === "string" ? value : "";
}

/** Normaliza el JSON a la forma que espera el schema del servidor. */
function parseBatch(raw: string): ParsedBatch {
  const trimmed = raw.trim();
  if (!trimmed) return { items: [], error: null };

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { items: [], error: "El JSON no es válido. Revisa comas y comillas." };
  }

  const rows = Array.isArray(data)
    ? data
    : typeof data === "object" && data !== null && Array.isArray((data as { tasks?: unknown[] }).tasks)
      ? (data as { tasks: unknown[] }).tasks
      : null;

  if (!rows) {
    return { items: [], error: 'El JSON debe ser una lista: [{"description": "..."}]' };
  }
  if (rows.length === 0) {
    return { items: [], error: "La lista está vacía." };
  }
  if (rows.length > 200) {
    return { items: [], error: "Máximo 200 tareas por lote." };
  }

  const items: MaintenanceTaskBatchItem[] = [];
  for (const [index, row] of rows.entries()) {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      return { items: [], error: `La tarea ${index + 1} no es un objeto.` };
    }
    const record = row as Record<string, unknown>;
    const candidate = {
      description: readDescription(record),
      isCritical: readFlag(record, ["isCritical", "is_critical", "critica", "critico"]),
      requiresPhoto: readFlag(record, ["requiresPhoto", "requires_photo", "requiereFoto", "foto"]),
    };
    const parsed = maintenanceTaskBatchItemSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        items: [],
        error: `Tarea ${index + 1}: ${issue?.message ?? "revisa el formato"}`,
      };
    }
    items.push(parsed.data);
  }

  return { items, error: null };
}

interface TaskBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleId: string;
  defaultZone: string;
  zones: Array<{ id: string; name: string }>;
  zoneTaskCounts: Partial<Record<string, number>>;
  onSaved: () => void;
}

export function TaskBatchDialog({
  open,
  onOpenChange,
  moduleId,
  defaultZone,
  zones,
  zoneTaskCounts,
  onSaved,
}: TaskBatchDialogProps) {
  const [zoneId, setZoneId] = useState(defaultZone);
  const [rawJson, setRawJson] = useState("");
  const [isPending, startTransition] = useTransition();

  const parsed = useMemo(() => parseBatch(rawJson), [rawJson]);

  function handleOpenChange(next: boolean) {
    if (next) {
      setZoneId(defaultZone);
      setRawJson("");
    }
    onOpenChange(next);
  }

  function handleFormat() {
    if (parsed.error) {
      toast.error("No se pudo formatear", { description: parsed.error });
      return;
    }
    if (parsed.items.length === 0) {
      toast.error("No se pudo formatear", {
        description: "Agrega al menos una tarea en el JSON.",
      });
      return;
    }
    setRawJson(JSON.stringify(parsed.items, null, 2));
  }

  function handleSubmit() {
    if (!zoneId) {
      toast.error("Selecciona la zona donde se agregarán las tareas.");
      return;
    }
    if (parsed.error) {
      toast.error("Revisa el JSON", { description: parsed.error });
      return;
    }
    if (parsed.items.length === 0) {
      toast.error("Agrega al menos una tarea en el JSON.");
      return;
    }

    startTransition(async () => {
      const res = await createMaintenanceTasksBatch(moduleId, { zoneId, tasks: parsed.items });
      if (res.success) {
        toast.success("Tareas agregadas", { description: res.message });
        onOpenChange(false);
        onSaved();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  const startOrder = (zoneTaskCounts[zoneId] ?? 0) + 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-2xl text-foreground shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ClipboardList className="size-4" />
            Nueva Tarea por Lotes
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Elige la zona y pega el JSON con las tareas. Se crean en el orden
            en que aparecen, a continuación de las que ya existen en la zona.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label
              htmlFor="batch-zone"
              className="text-xs font-semibold text-foreground"
            >
              Zona *
            </label>
            <Select value={zoneId} onValueChange={(value) => setZoneId(value ?? "")}>
              <SelectTrigger id="batch-zone" className={inputClass + " w-full h-9"}>
                <SelectValue placeholder="Selecciona la zona" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Las tareas se numerarán del {startOrder} al{" "}
              {startOrder + Math.max(parsed.items.length - 1, 0)} en{" "}
              {zones.find((z) => z.id === zoneId)?.name ?? "la zona"}.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="batch-json"
                className="text-xs font-semibold text-foreground"
              >
                Tareas (JSON) *
              </label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRawJson(SAMPLE_JSON)}
                  className="h-7 gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  <Wand2 className="size-3.5" />
                  Ejemplo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleFormat}
                  disabled={parsed.items.length === 0}
                  className="h-7 gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  Formatear
                </Button>
              </div>
            </div>
            <Textarea
              id="batch-json"
              value={rawJson}
              onChange={(event) => setRawJson(event.target.value)}
              rows={12}
              spellCheck={false}
              placeholder={SAMPLE_JSON}
              className={inputClass + " resize-y font-mono text-[11px] leading-relaxed"}
            />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Cada tarea usa <code className="font-mono">description</code> y
              opcionalmente <code className="font-mono">isCritical</code> y{" "}
              <code className="font-mono">requiresPhoto</code> con{" "}
              <code className="font-mono">0</code> o{" "}
              <code className="font-mono">1</code>. También se aceptan{" "}
              <code className="font-mono">true</code>/
              <code className="font-mono">false</code> y nombres como{" "}
              <code className="font-mono">critica</code> o{" "}
              <code className="font-mono">foto</code>.
            </p>
          </div>

          {parsed.error ? (
            <p className="rounded-lg border border-red-300 bg-red-500/5 px-3 py-2 text-[11px] font-medium text-red-600 dark:border-red-900 dark:text-red-400">
              {parsed.error}
            </p>
          ) : parsed.items.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/30">
              <p className="border-b border-border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Vista previa: {parsed.items.length}{" "}
                {parsed.items.length === 1 ? "tarea" : "tareas"}
              </p>
              <ol className="max-h-40 divide-y divide-border overflow-y-auto">
                {parsed.items.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 px-3 py-1.5 text-[11px]"
                  >
                    <span className="w-5 shrink-0 font-mono text-muted-foreground">
                      {startOrder + index}.
                    </span>
                    <span className="min-w-0 flex-1 text-foreground">
                      {item.description}
                    </span>
                    {item.isCritical && (
                      <span
                        title="Tarea crítica"
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-300 px-1.5 py-0.5 text-[9px] font-bold text-red-600 dark:border-red-900 dark:text-red-400"
                      >
                        <ShieldAlert className="size-2.5" />
                        Crítica
                      </span>
                    )}
                    {item.requiresPhoto && (
                      <span
                        title="Requiere foto"
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground"
                      >
                        <Camera className="size-2.5" />
                        Foto
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>

        <DialogFooter className="pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs border-border"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isPending || parsed.items.length === 0 || !!parsed.error}
            onClick={handleSubmit}
            className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            Crear {parsed.items.length > 0 ? parsed.items.length : ""}{" "}
            {parsed.items.length === 1 ? "tarea" : "tareas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
