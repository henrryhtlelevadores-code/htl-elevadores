"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Loader2, MapPinned } from "lucide-react";
import { type ElevatorType, type MaintenanceZone } from "@/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createMaintenanceZone, deleteMaintenanceZone, updateMaintenanceZone } from "../actions";

type ZoneForm = { code: string; name: string; orderIndex: number; isActive: boolean; elevatorTypeId: string };

export function MaintenanceZonesTab({ initialZones, elevatorTypes }: { initialZones: MaintenanceZone[]; elevatorTypes: ElevatorType[] }) {
  const router = useRouter();
  const [zones, setZones] = useState(initialZones);
  const [editing, setEditing] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<ZoneForm & { elevatorTypeId: string }>({ code: "", name: "", orderIndex: 0, isActive: true, elevatorTypeId: elevatorTypes[0]?.id ?? "" });
  const [selectedType, setSelectedType] = useState(elevatorTypes[0]?.id ?? "all");
  const visibleZones = selectedType === "all" ? zones : zones.filter((zone) => zone.elevatorTypeId === selectedType);

  function openCreate() {
    const typeId = selectedType === "all" ? (elevatorTypes[0]?.id ?? "") : selectedType;
    const typeZoneCount = zones.filter((zone) => zone.elevatorTypeId === typeId).length;
    setEditing("new");
    setForm({ code: "Automático", name: "", orderIndex: typeZoneCount + 1, isActive: true, elevatorTypeId: typeId });
  }

  function openEdit(zone: MaintenanceZone) {
    setEditing(zone.id);
    setForm({ code: zone.code, name: zone.name, orderIndex: zone.orderIndex, isActive: zone.isActive ?? true, elevatorTypeId: zone.elevatorTypeId ?? "" });
  }

  function closeDialog() {
    if (!isPending) setEditing(null);
  }

  function save() {
    startTransition(async () => {
      const result = editing === "new"
        ? await createMaintenanceZone(form)
        : await updateMaintenanceZone(editing!, form);
      if (!result.success) {
        toast.error("Error", { description: result.error });
        return;
      }
      toast.success(result.message);
      setEditing(null);
      if (result.zone) {
        const savedZone = result.zone as MaintenanceZone;
        setZones((current) => editing === "new"
          ? [...current, savedZone].sort((a, b) => a.orderIndex - b.orderIndex)
          : current.map((zone) => zone.id === savedZone.id ? savedZone : zone)
        );
      }
      router.refresh();
    });
  }

  function remove(zone: MaintenanceZone) {
    if (!window.confirm(`¿Eliminar la zona ${zone.name}?`)) return;
    startTransition(async () => {
      const result = await deleteMaintenanceZone(zone.id);
      if (!result.success) toast.error("No se puede eliminar", { description: result.error });
      else {
        toast.success(result.message);
        setZones((current) => current.filter((item) => item.id !== zone.id));
      }
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground">Zonas de Mantenimiento</h2>
          <p className="text-xs text-muted-foreground">Catálogo usado por las tareas de mantenimiento.</p>
        </div>
        <Button onClick={openCreate} className="h-9 w-full gap-2 bg-[#0066CC] text-xs text-white hover:bg-[#0055AA] sm:w-auto">
          <Plus className="size-4" /> Añadir zona
        </Button>
      </div>
      <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="h-9 w-full rounded-md border border-border bg-card px-3 text-xs sm:max-w-sm">
        <option value="all">Todos los tipos de equipo</option>
        {elevatorTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
      </select>

      <Dialog open={!!editing} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editing === "new" ? "Añadir Zona de Mantenimiento" : "Editar Zona de Mantenimiento"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              El código y el orden se generan automáticamente al crear una zona.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold">Código</label>
                <Input value={form.code} readOnly className="mt-1 bg-muted/40 text-xs" />
              </div>
              <div>
                <label className="text-xs font-semibold">Order Index</label>
                <Input value={form.orderIndex} readOnly className="mt-1 bg-muted/40 text-xs" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold">Nombre *</label>
              <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Sala de máquinas" className="mt-1 text-xs" />
            </div>
            <div>
              <label className="text-xs font-semibold">Tipo de Equipo *</label>
              <select value={form.elevatorTypeId} onChange={(e) => setForm({ ...form, elevatorTypeId: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs">
                {elevatorTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <Checkbox checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked === true })} />
              Zona activa
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeDialog} disabled={isPending} className="text-xs">Cancelar</Button>
            <Button size="sm" onClick={save} disabled={isPending || form.name.trim().length < 2} className="gap-2 bg-[#0066CC] text-xs text-white hover:bg-[#0055AA]">
              {isPending && <Loader2 className="size-3.5 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full min-w-[560px] text-xs">
          <thead className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-3">Orden</th><th className="px-4 py-3">Código</th><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleZones.map((zone) => (
              <tr key={zone.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-mono text-muted-foreground">{zone.orderIndex}</td>
                <td className="px-4 py-3 font-mono font-semibold">{zone.code}</td>
                <td className="px-4 py-3 font-semibold">{zone.name}</td>
                <td className="px-4 py-3">{zone.isActive ? "Activa" : "Inactiva"}</td>
                <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon-xs" onClick={() => openEdit(zone)} title="Editar"><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon-xs" onClick={() => remove(zone)} title="Eliminar" className="text-destructive"><Trash2 className="size-3.5" /></Button></div></td>
              </tr>
            ))}
            {visibleZones.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><MapPinned className="mx-auto mb-2 size-6" />No hay zonas registradas para este tipo.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
