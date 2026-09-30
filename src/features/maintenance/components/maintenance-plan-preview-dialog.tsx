"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { getMaintenancePlanPreview } from "../actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Client = { id: string; legalName: string };
type CostCenter = { id: string; clientId: string; name: string };
type Contract = { id: string; costCenterId: string; contractNumber: string };
type Elevator = { id: string; elevatorUnityId: string; contractId: string; internal_code?: string | null; elevator_name?: string | null };

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"];

export function MaintenancePlanPreviewDialog({ clients, costCenters, contracts, elevators }: { clients: Client[]; costCenters: CostCenter[]; contracts: Contract[]; elevators: Elevator[] }) {
  const currentMonth = new Date().getMonth() + 1;
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [contractId, setContractId] = useState("");
  const [elevatorIds, setElevatorIds] = useState<string[]>([]);
  const [month, setMonth] = useState(currentMonth);
  const [result, setResult] = useState<Awaited<ReturnType<typeof getMaintenancePlanPreview>> | null>(null);
  const [, startTransition] = useTransition();
  const visibleCenters = costCenters.filter((center) => center.clientId === clientId);
  const visibleContracts = contracts.filter((contract) => contract.costCenterId === costCenterId);
  const visibleElevators = elevators.filter((elevator) => elevator.contractId === contractId);

  function loadPreview() {
    if (!contractId || elevatorIds.length === 0) return;
    startTransition(async () => {
      try { setResult(await getMaintenancePlanPreview(contractId, elevatorIds, month)); }
      catch { toast.error("No se pudo consultar el plan."); }
    });
  }

  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Consultar plan</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-card text-foreground sm:max-w-3xl">
        <DialogHeader><DialogTitle>Consulta de Plan de Mantenimiento</DialogTitle><DialogDescription>Consulta los módulos que corresponden a cada equipo en un mes específico.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={clientId} onChange={(e) => { setClientId(e.target.value); setCostCenterId(""); setContractId(""); setElevatorIds([]); setResult(null); }} className="h-9 rounded-md border border-border bg-background px-2 text-xs"><option value="">Cliente *</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.legalName}</option>)}</select>
          <select value={costCenterId} disabled={!clientId} onChange={(e) => { setCostCenterId(e.target.value); setContractId(""); setElevatorIds([]); setResult(null); }} className="h-9 rounded-md border border-border bg-background px-2 text-xs"><option value="">Centro de costos *</option>{visibleCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select>
          <select value={contractId} disabled={!costCenterId} onChange={(e) => { setContractId(e.target.value); setElevatorIds(e.target.value ? elevators.filter((elevator) => elevator.contractId === e.target.value).map((elevator) => elevator.elevatorUnityId) : []); setResult(null); }} className="h-9 rounded-md border border-border bg-background px-2 text-xs"><option value="">Contrato *</option>{visibleContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.contractNumber}</option>)}</select>
          <select value={String(month)} onChange={(e) => setMonth(Number(e.target.value))} className="h-9 rounded-md border border-border bg-background px-2 text-xs">{MONTHS.map((label, index) => <option key={index + 1} value={index + 1}>{label} {new Date().getFullYear()}</option>)}</select>
        </div>
        <div className="rounded-lg border border-border p-3"><p className="mb-2 text-xs font-semibold">Equipos *</p><div className="grid gap-2 sm:grid-cols-2">{visibleElevators.map((elevator) => <label key={elevator.elevatorUnityId} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={elevatorIds.includes(elevator.elevatorUnityId)} onChange={(e) => setElevatorIds((current) => e.target.checked ? [...current, elevator.elevatorUnityId] : current.filter((id) => id !== elevator.elevatorUnityId))} />{elevator.internal_code} · {elevator.elevator_name}</label>)}</div></div>
        <Button disabled={!contractId || elevatorIds.length === 0} onClick={loadPreview}>Consultar</Button>
        {result && <div className="space-y-3 border-t border-border pt-4">{result.elevators.map((elevator) => <article key={elevator.id} className="rounded-xl border border-border p-3"><div className="flex items-center gap-2"><span className="rounded bg-muted px-2 py-1 font-mono text-xs font-bold">{elevator.internalCode}</span><strong className="text-sm">{elevator.name}</strong></div><p className="mt-1 text-xs text-muted-foreground">{elevator.elevatorType ?? "Equipo"} · {elevator.brand ?? "Marca no registrada"}</p><ul className="mt-3 space-y-1">{elevator.modules.map((module) => <li key={module.id} className={`flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-xs ${module.appliesThisMonth ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-muted/40 text-muted-foreground"}`}><span>{module.appliesThisMonth ? "✅" : "⬜"}</span><strong>{module.code} · {module.name}</strong><span>{module.frequencyPerYear}/año · {module.monthsOfYear}</span>{module.appliesThisMonth && <span className="ml-auto font-semibold">{module.taskCount} tareas</span>}</li>)}</ul></article>)}<div className="rounded-xl border border-[#0066CC]/20 bg-[#0066CC]/5 p-4 text-sm"><strong>Resumen del mes</strong><ul className="mt-2 space-y-1 text-xs"><li>Equipos consultados: {result.summary.elevatorsCount}</li><li>Total de módulos a ejecutar: {result.summary.modulesToExecute}</li><li>Total de tareas: {result.summary.tasksToExecute}</li></ul></div></div>}
      </DialogContent>
    </Dialog>
  </>;
}
