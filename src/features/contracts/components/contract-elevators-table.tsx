"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  type ContractWithRelations,
  type ContractElevatorWithRelations,
  createContractElevator,
  updateContractElevator,
  deleteContractElevator,
} from "../actions";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";

import { Button } from "@/components/ui/button";
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
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Cpu,
  MapPin,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface ContractElevatorsTableProps {
  contract: ContractWithRelations | null;
  contractElevators: ContractElevatorWithRelations[];
  equipmentOptions: Array<{ id: string; internalCode: string; name: string }>;
}

function formatMoney(currency: string, amount: number): string {
  return `${currency} ${amount.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

export function ContractElevatorsTable({
  contract,
  contractElevators,
  equipmentOptions,
}: ContractElevatorsTableProps) {
  const router = useRouter();
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [targetElevator, setTargetElevator] = useState<ContractElevatorWithRelations | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingElevator, setEditingElevator] = useState<ContractElevatorWithRelations | null>(null);
  const [freqInput, setFreqInput] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [isPending, startTransition] = useTransition();

  const availableOptions = equipmentOptions.filter(
    (eq) => !contractElevators.some((ce) => ce.elevatorUnityId === eq.id)
  );

  const totalEquipos = contractElevators.reduce((sum, ce) => sum + (ce.price || 0), 0);
  const contractAmount = contract?.baseAmount ?? 0;
  const matches = Math.abs(totalEquipos - contractAmount) < 0.01;
  const diff = totalEquipos - contractAmount;
  const currency = contract?.currency || "PEN";

  function handleAdd() {
    if (!contract || !selectedEquipmentId) return;
    startTransition(async () => {
      const res = await createContractElevator({
        contractId: contract.id,
        elevatorUnityId: selectedEquipmentId,
        frequencyMonths: 1,
        price: 0,
      });
      if (res.success) {
        toast.success("Equipo vinculado", { description: "El equipo fue agregado al contrato." });
        setSelectedEquipmentId("");
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleSaveEdit() {
    if (!editingElevator) return;
    const freq = parseInt(freqInput, 10);
    const price = parseFloat(priceInput);
    if (!Number.isInteger(freq) || freq < 1) {
      toast.error("Frecuencia inválida", { description: "Ingresa un número entero mayor o igual a 1." });
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Precio inválido", { description: "Ingresa un precio mayor o igual a 0." });
      return;
    }
    startTransition(async () => {
      const res = await updateContractElevator(editingElevator.id, {
        frequencyMonths: freq,
        price,
      });
      if (res.success) {
        toast.success("Equipo actualizado", {
          description: `${editingElevator.internal_code} — frecuencia y precio actualizados.`,
        });
        setIsEditOpen(false);
        setEditingElevator(null);
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleRemove() {
    if (!targetElevator) return;
    startTransition(async () => {
      const res = await deleteContractElevator(targetElevator.id);
      if (res.success) {
        toast.success("Equipo removido", {
          description: `Se desvinculó ${targetElevator.internal_code}.`,
        });
        setIsDeleteOpen(false);
        setTargetElevator(null);
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  const columns = useMemo<ColumnDef<ContractElevatorWithRelations>[]>(
    () => [
      {
        accessorKey: "internal_code",
        header: "Código",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border border-border">
            {row.getValue("internal_code")}
          </span>
        ),
      },
      {
        accessorKey: "elevator_name",
        header: "Equipo",
        cell: ({ row }) => (
          <div className="flex items-center gap-2 text-foreground">
            <Cpu className="size-3.5 text-[#0066CC] shrink-0" />
            <span className="font-semibold">{row.getValue("elevator_name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "cost_center_name",
        header: "Centro de Costo",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground max-w-[200px]">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{row.getValue("cost_center_name")}</span>
          </div>
        ),
      },
      {
        accessorKey: "frequencyMonths",
        header: "Frecuencia",
        cell: ({ row }) => {
          const freq = row.getValue<number | null>("frequencyMonths");
          return <span className="text-xs font-mono text-muted-foreground">{freq ? `${freq} meses` : "—"}</span>;
        },
      },
      {
        accessorKey: "price",
        header: "Precio",
        cell: ({ row }) => {
          const price = row.getValue<number>("price");
          return (
            <span className="text-xs font-mono font-semibold">
              {formatMoney(currency, price)}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        cell: ({ row }) => {
          const ce = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setEditingElevator(ce);
                  setFreqInput(String(ce.frequencyMonths ?? ""));
                  setPriceInput(String(ce.price ?? ""));
                  setIsEditOpen(true);
                }}
                className="text-[#0066CC] hover:bg-[#0066CC]/10"
                title="Editar frecuencia y precio"
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => { setTargetElevator(ce); setIsDeleteOpen(true); }}
                className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                title="Desvincular equipo"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [currency]
  );

  if (!contract) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2.5">
          <Select value={selectedEquipmentId} onValueChange={(v) => v && setSelectedEquipmentId(v)}>
            <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
              <SelectValue placeholder="Selecciona un equipo disponible...">
                {(() => {
                  const eq = equipmentOptions.find((e) => e.id === selectedEquipmentId);
                  return eq ? `${eq.internalCode} — ${eq.name}` : null;
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableOptions.length === 0 ? (
                <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                  No hay equipos disponibles para vincular
                </div>
              ) : (
                availableOptions.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id}>
                    {eq.internalCode} — {eq.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button
            onClick={handleAdd}
            disabled={!selectedEquipmentId || isPending}
            size="sm"
            className="h-9 bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs gap-2 shadow-xs shrink-0"
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            <Plus className="size-4" />
            Agregar Equipo
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">Total Equipos:</span>
          <span className="font-mono font-semibold text-foreground">{formatMoney(currency, totalEquipos)}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">Monto del Contrato:</span>
          <span className="font-mono font-semibold text-foreground">{formatMoney(currency, contractAmount)}</span>
        </div>
        <div>
          {matches ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Coincide con el contrato
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <XCircle className="size-3" />
              {diff > 0 ? "Excede" : "Falta"} {formatMoney(currency, Math.abs(diff))}
            </span>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={contractElevators}
        searchPlaceholder="Buscar equipo vinculado..."
      />

      {/* Dialog: Editar Frecuencia y Precio */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingElevator(null); }}>
        <DialogContent className="bg-card border-border sm:max-w-[380px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil className="size-4 text-[#0066CC]" />
              Editar Equipo del Contrato
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Actualiza la frecuencia y el precio de{" "}
              <strong className="text-foreground font-mono">{editingElevator?.internal_code}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Frecuencia (meses)</label>
              <Input
                type="number"
                min="1"
                step="1"
                value={freqInput}
                onChange={(e) => setFreqInput(e.target.value)}
                placeholder="Ej: 1, 2, 3..."
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Precio</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="0.00"
                className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(false)}
              className="text-xs border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleSaveEdit}
              className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Eliminación */}
      <Dialog open={isDeleteOpen} onOpenChange={(open) => !open && setIsDeleteOpen(false)}>
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 dark:text-red-400">
              Desvincular Equipo
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Quieres desvincular{" "}
              <strong className="text-foreground">{targetElevator?.internal_code}</strong> —{" "}
              {targetElevator?.elevator_name} del contrato?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteOpen(false)}
              className="text-xs border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleRemove}
              className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold gap-2"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Desvincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}