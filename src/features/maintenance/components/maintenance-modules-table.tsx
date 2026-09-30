"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { type ElevatorType } from "@/db";
import { toggleMaintenanceModule, type MaintenanceModuleWithCount } from "../actions";
import { MONTH_LABELS } from "../constants";
import { ModuleFormDialog } from "./module-form-dialog";
import { MaintenancePlanPreviewDialog } from "./maintenance-plan-preview-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  ListChecks,
  Loader2,
  Power,
  PowerOff,
} from "lucide-react";

type StatusFilter = "all" | "active" | "inactive";

export function MaintenanceModulesTable({
  initialModules,
  elevatorTypes,
  clients,
  costCenters,
  contracts,
  elevators,
}: {
  initialModules: MaintenanceModuleWithCount[];
  elevatorTypes: ElevatorType[];
  clients: Array<{ id: string; legalName: string }>;
  costCenters: Array<{ id: string; clientId: string; name: string }>;
  contracts: Array<{ id: string; costCenterId: string; contractNumber: string }>;
  elevators: Array<{ id: string; contractId: string; elevatorUnityId: string; internal_code?: string | null; elevator_name?: string | null }>;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingModule, setEditingModule] =
    useState<MaintenanceModuleWithCount | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return initialModules.filter((m) => {
      if (typeFilter !== "all" && m.elevatorTypeId !== typeFilter) return false;
      if (statusFilter === "active" && !m.isActive) return false;
      if (statusFilter === "inactive" && m.isActive) return false;
      if (!term) return true;
      return (
        m.code.toLowerCase().includes(term) ||
        m.name.toLowerCase().includes(term) ||
        (m.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [initialModules, search, statusFilter, typeFilter]);

  function handleToggle(module: MaintenanceModuleWithCount) {
    setTogglingId(module.id);
    startTransition(async () => {
      const res = await toggleMaintenanceModule(module.id, !module.isActive);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
      setTogglingId(null);
    });
  }

  const columns = useMemo<ColumnDef<MaintenanceModuleWithCount>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Código",
        cell: ({ row }) => (
          <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-bold">
            {row.original.code}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Nombre",
        size: 280,
        minSize: 220,
        maxSize: 360,
        cell: ({ row }) => (
          <div className="w-[220px] max-w-[360px] whitespace-normal break-words sm:w-[280px]">
            <p className="font-semibold leading-snug text-foreground">
              {row.original.name}
            </p>
            {row.original.description && (
              <p className="mt-1 whitespace-normal break-words text-[10px] leading-snug text-muted-foreground">
                {row.original.description}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "months",
        header: "Meses",
        cell: ({ row }) => {
          const months = (row.original.monthsOfYear ?? "").split(",").filter(Boolean).map(Number);
          return (
            <span className="text-[11px] text-muted-foreground">
              {months.map((month) => MONTH_LABELS[month - 1]).filter(Boolean).join(", ") || "—"}
            </span>
          );
        },
      },
      {
        id: "estado",
        header: "Estado",
        cell: ({ row }) => {
          const active = row.original.isActive;
          return (
            <span
              className={
                active
                  ? "inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
                  : "inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"
              }
            >
              <span
                className={
                  active
                    ? "size-2 rounded-full bg-emerald-500"
                    : "size-2 rounded-full bg-muted-foreground/40"
                }
              />
              {active ? "Activo" : "Inactivo"}
            </span>
          );
        },
      },
      {
        id: "acciones",
        header: "Acciones",
        cell: ({ row }) => {
          const maintenanceModule = row.original;
          return (
            <div className="flex items-center gap-1">
              <Link
                href={`/configuracion/mantenimiento/modulos/${maintenanceModule.id}/tareas`}
                title="Ver tareas del módulo"
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <ListChecks className="size-3.5" />
              </Link>
              <Button
                variant="ghost"
                size="icon-xs"
                title="Editar módulo"
                onClick={() => {
                  setEditingModule(maintenanceModule);
                  setIsFormOpen(true);
                }}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                title={
                  maintenanceModule.isActive
                    ? "Desactivar módulo"
                    : "Activar módulo"
                }
                disabled={togglingId === maintenanceModule.id}
                onClick={() => handleToggle(maintenanceModule)}
                className={
                  maintenanceModule.isActive
                    ? "text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400"
                    : "text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
                }
              >
                {togglingId === maintenanceModule.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : maintenanceModule.isActive ? (
                  <PowerOff className="size-3.5" />
                ) : (
                  <Power className="size-3.5" />
                )}
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [togglingId]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Input
          placeholder="Buscar por código, nombre o descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-card border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC] sm:max-w-sm"
        />
        <div className="flex items-center gap-2">
          <MaintenancePlanPreviewDialog clients={clients} costCenters={costCenters} contracts={contracts} elevators={elevators} />
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? "all")}>
            <SelectTrigger className="h-9 w-[180px] bg-card border-border text-xs"><SelectValue placeholder="Tipo de equipo" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos los tipos</SelectItem>{elevatorTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="h-9 w-[150px] bg-card border-border text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Solo activos</SelectItem>
              <SelectItem value="inactive">Solo inactivos</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              setEditingModule(null);
              setIsFormOpen(true);
            }}
            className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs"
          >
            <Plus className="size-4" />
            Nuevo Módulo
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        hideSearch
        searchPlaceholder="Buscar módulos..."
        emptyState="No se encontraron módulos de mantenimiento."
      />

      <p className="px-1 text-[10px] text-muted-foreground">
        Los módulos no se eliminan: desactívalos si dejan de usarse, así los
        contratos y el histórico conservan la referencia.
      </p>

      <ModuleFormDialog
        key={editingModule?.id ?? "new"}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        module={editingModule}
        elevatorTypes={elevatorTypes}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
