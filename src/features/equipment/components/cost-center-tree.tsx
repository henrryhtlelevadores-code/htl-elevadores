"use client";

import { useState, useMemo } from "react";
import { ChevronRight, ListTree, MapPin, Cpu } from "lucide-react";
import { cn } from "cn";
import type { ElevatorUnityWithRelations, EquipmentFormData } from "../actions";

interface CostCenterTreeProps {
  costCenters: EquipmentFormData["costCenters"];
  equipment: ElevatorUnityWithRelations[];
  selectedCostCenterId: string | null;
  onSelectCostCenter: (id: string) => void;
}

const STATUS_DOT: Record<string, string> = {
  OPERATIVE: "bg-emerald-500",
  MAINTENANCE: "bg-amber-500",
  OUT_OF_SERVICE: "bg-red-500",
};

export function CostCenterTree({
  costCenters,
  equipment,
  selectedCostCenterId,
  onSelectCostCenter,
}: CostCenterTreeProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const equipmentByCenter = useMemo(() => {
    const map = new Map<string, ElevatorUnityWithRelations[]>();
    for (const eq of equipment) {
      const arr = map.get(eq.costCenterId) ?? [];
      arr.push(eq);
      map.set(eq.costCenterId, arr);
    }
    return map;
  }, [equipment]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ListTree className="size-4 text-[#0066CC]" />
          <span className="text-xs font-bold text-foreground">Filtrar por Centro de Costo</span>
        </div>
        <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {costCenters.length}
        </span>
      </div>

      <div className="max-h-[calc(100vh-16rem)] space-y-1 overflow-y-auto p-2">
        {costCenters.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Sin centros de costo registrados.
          </p>
        )}

        {costCenters.map((cc) => {
          const items = equipmentByCenter.get(cc.id) ?? [];
          const isExpanded = expandedId === cc.id;
          const isSelected = selectedCostCenterId === cc.id;

          return (
            <div
              key={cc.id}
              className={cn(
                "overflow-hidden rounded-lg transition-colors",
                isSelected && "bg-[#0066CC]/5 ring-1 ring-[#0066CC]/20"
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-2 cursor-pointer transition-colors",
                  isSelected ? "bg-[#0066CC]/10" : "hover:bg-muted/50"
                )}
                onClick={() => {
                  setExpandedId(isExpanded ? null : cc.id);
                  onSelectCostCenter(cc.id);
                }}
              >
                <button
                  type="button"
                  aria-label={isExpanded ? "Colapsar" : "Expandir"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedId(isExpanded ? null : cc.id);
                  }}
                  className="rounded p-0.5 text-muted-foreground transition-transform hover:bg-muted hover:text-foreground"
                >
                  <ChevronRight
                    className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")}
                  />
                </button>
                <MapPin
                  className={cn(
                    "size-3.5 shrink-0",
                    isSelected ? "text-[#0066CC] dark:text-blue-400" : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-xs font-semibold",
                    isSelected ? "text-[#0066CC] dark:text-blue-400" : "text-foreground"
                  )}
                >
                  {cc.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {items.length}
                </span>
              </div>

              {isExpanded && (
                <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border/60 pl-2 pb-0.5">
                  {items.length === 0 && (
                    <p className="px-2 py-1 text-[11px] text-muted-foreground">Sin equipos</p>
                  )}
                  {items.map((eq) => (
                    <div
                      key={eq.id}
                      title={eq.name}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/40"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Cpu className="size-3 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium text-foreground">{eq.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={cn("size-1.5 rounded-full", STATUS_DOT[eq.status ?? ""] ?? "bg-zinc-400")}
                        />
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {eq.internalCode}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}