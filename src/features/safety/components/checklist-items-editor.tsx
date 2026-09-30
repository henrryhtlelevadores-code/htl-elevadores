"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, TriangleAlert, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  label: string;
  isCritical: boolean;
}

interface ChecklistItemsEditorProps {
  value: string;
  onChange: (json: string) => void;
  placeholder?: string;
}

let idCounter = 0;

function nextId() {
  idCounter += 1;
  return `t${Date.now()}_${idCounter}`;
}

function parseItems(value: string): ChecklistItem[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item, i) => ({
        id: item.id || `t${i + 1}`,
        label: typeof item.label === "string" ? item.label : "",
        isCritical: Boolean(item.isCritical),
      }));
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function ChecklistItemsEditor({
  value,
  onChange,
  placeholder = "Ej: Verificar frenos y puertas",
}: ChecklistItemsEditorProps) {
  const items = useMemo(() => parseItems(value), [value]);
  const [batchJson, setBatchJson] = useState("");
  const [batchError, setBatchError] = useState("");

  function emit(nextItems: ChecklistItem[]) {
    onChange(JSON.stringify(nextItems));
  }

  function addItem() {
    emit([...items, { id: nextId(), label: "", isCritical: false }]);
  }

  function removeItem(id: string) {
    emit(items.filter((i) => i.id !== id));
  }

  function updateLabel(id: string, label: string) {
    emit(items.map((i) => (i.id === id ? { ...i, label } : i)));
  }

  function toggleCritical(id: string) {
    emit(items.map((i) => (i.id === id ? { ...i, isCritical: !i.isCritical } : i)));
  }

  function applyBatch() {
    try {
      const parsed = JSON.parse(batchJson);
      if (!Array.isArray(parsed)) throw new Error("Debe ser un arreglo JSON.");
      const next = parsed.map((item, index) => {
        if (typeof item === "string") return { id: nextId(), label: item, isCritical: false };
        if (!item || typeof item.label !== "string" || !item.label.trim()) {
          throw new Error(`El elemento ${index + 1} debe tener "label".`);
        }
        return { id: item.id || nextId(), label: item.label.trim(), isCritical: Boolean(item.isCritical) };
      });
      emit(next);
      setBatchError("");
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : "JSON inválido.");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
          <ListChecks className="size-3.5 text-[#0066CC]" />
          Ítems del Checklist ({items.length})
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground border border-dashed border-border rounded-md px-3 py-4 text-center">
          Aún no hay ítems. Agrega el primero con el botón de abajo.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#0066CC]/10 text-[10px] font-bold text-[#0066CC] dark:text-blue-400">
                {index + 1}
              </span>
              <Input
                value={item.label}
                onChange={(e) => updateLabel(item.id, e.target.value)}
                placeholder={placeholder}
                className="bg-background border-border text-xs h-9 focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toggleCritical(item.id)}
                className={cn(
                  "h-9 shrink-0 gap-1.5 px-2.5 text-[11px] font-semibold border transition-colors",
                  item.isCritical
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-border text-muted-foreground bg-background"
                )}
                title={item.isCritical ? "Ítem crítico" : "Marcar como crítico"}
              >
                <TriangleAlert className="size-3.5" />
                {item.isCritical ? "Crítico" : "Normal"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => removeItem(item.id)}
                className="size-9 shrink-0 text-red-500 hover:text-red-700 hover:bg-red-500/10"
                title="Quitar ítem"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        className="w-full border-dashed border-[#0066CC]/40 text-[#0066CC] dark:text-blue-400 hover:bg-[#0066CC]/5 text-xs gap-2 font-semibold"
      >
        <Plus className="size-3.5" />
        Añadir Ítem
      </Button>

      <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/20 p-3">
        <div>
          <p className="text-[11px] font-semibold">Agregar ítems por lote (JSON)</p>
          <p className="text-[10px] text-muted-foreground">Acepta textos simples o elementos con <code>label</code> e <code>isCritical</code>.</p>
        </div>
        <Textarea
          value={batchJson}
          onChange={(event) => setBatchJson(event.target.value)}
          placeholder={'[\n  { "label": "Verificar puertas", "isCritical": false },\n  { "label": "Revisar freno", "isCritical": true }\n]'}
          className="min-h-28 bg-background font-mono text-[11px]"
        />
        {batchError && <p className="text-[11px] text-red-600">{batchError}</p>}
        <Button type="button" variant="secondary" size="sm" onClick={applyBatch} className="text-xs">
          Aplicar JSON
        </Button>
      </div>
    </div>
  );
}
