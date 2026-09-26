"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ChevronRight,
  Plus,
  Loader2,
  MoreHorizontal,
  Clock,
  Zap,
  MapPin,
  ArrowRight,
  Trash2,
  Settings2,
  CalendarCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  CalendarClock,
  Users,
} from "lucide-react";

import {
  type TechnicianOption,
  type PreventiveContractOption,
  type PreventiveRouteWithStops,
  type RouteStopWithRelations,
  type RouteConfigRow,
  type GenerationResult,
  getPreventiveRoutes,
  getRouteConfig,
  createRouteStops,
  updateRouteStopsTime,
  updateRouteStopDuration,
  moveRouteStops,
  deleteRouteStops,
  updateRouteConfig,
  resetRouteConfig,
  generateMonth,
} from "../actions";
import {
  routeStopSheetSchema,
  routeConfigSchema,
  type RouteStopSheetValues,
} from "../schema";
import { isContractInactive, visitKeyOfStop } from "../visits";
import {
  ROUTE_DEFAULTS,
  formatMonthLabel,
  nextMonthLabel,
  resolveDayCapacity,
} from "../schedule";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { TimePicker } from "@/components/ui/time-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface RoutesBoardProps {
  technicians: TechnicianOption[];
  contractOptions: PreventiveContractOption[];
  defaultRoutes: PreventiveRouteWithStops[];
  defaultConfig: RouteConfigRow;
}

type StopGroup = {
  key: string;
  visitGroupId: string | null;
  plannedTime: string;
  costCenterId: string;
  costCenterName: string;
  stops: RouteStopWithRelations[];
};

function formatTime(t: string): string {
  const [h, m] = t.split(":");
  const hh = Number(h);
  const suffix = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour12}:${m} ${suffix}`;
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function shortMonth(month: string | null): string {
  if (!month) return "";
  const [y, m] = month.split("-");
  return `${m}/${y}`;
}

function groupStops(stops: RouteStopWithRelations[]): StopGroup[] {
  const map = new Map<string, StopGroup>();
  for (const s of stops) {
    // Una visita = un visit_group_id. Fallback legacy: (hora + sede).
    const key = visitKeyOfStop(s);
    const g = map.get(key) ?? {
      key,
      visitGroupId: s.visitGroupId,
      plannedTime: s.plannedTime,
      costCenterId: s.costCenterId,
      costCenterName: s.costCenterName,
      stops: [],
    };
    g.stops.push(s);
    map.set(key, g);
  }
  return [...map.values()];
}

export function RoutesBoard({
  technicians,
  contractOptions,
  defaultRoutes,
  defaultConfig,
}: RoutesBoardProps) {
  const [technicianId, setTechnicianId] = useState(technicians[0]?.id ?? "");
  const [routes, setRoutes] = useState<PreventiveRouteWithStops[]>(
    technicians[0] ? defaultRoutes : []
  );
  const [config, setConfig] = useState<RouteConfigRow>(
    technicians[0] ? defaultConfig : { ...defaultConfig, technicianId: "" }
  );
  const [isPending, startTransition] = useTransition();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeSheetDay, setActiveSheetDay] = useState(1);

  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [durationInput, setDurationInput] = useState("120");

  const [editGroup, setEditGroup] = useState<StopGroup | null>(null);
  const [detailGroup, setDetailGroup] = useState<StopGroup | null>(null);
  const [timeInput, setTimeInput] = useState("");
  const [moveGroup, setMoveGroup] = useState<StopGroup | null>(null);
  const [moveDayInput, setMoveDayInput] = useState("1");
  const [deleteGroup, setDeleteGroup] = useState<StopGroup | null>(null);

  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [generateMonthInput, setGenerateMonthInput] = useState(nextMonthLabel());
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);

  const sheetForm = useForm<RouteStopSheetValues>({
    resolver: zodResolver(routeStopSheetSchema),
    defaultValues: {
      contractId: "",
      plannedTime: "09:00",
      estimatedDurationMins: ROUTE_DEFAULTS.defaultStopDurationMins,
      elevatorUnityIds: [],
    },
  });

  const configForm = useForm({
    resolver: zodResolver(routeConfigSchema),
    values: {
      totalDays: config.totalDays,
      maxDays: config.maxDays,
      includeSaturdays: config.includeSaturdays,
      saturdayMaxHours: config.saturdayMaxHours,
      defaultStopDurationMins: config.defaultStopDurationMins,
    },
  });

  const selectedContract = contractOptions.find(
    (c) => c.id === sheetForm.watch("contractId")
  );
  const selectedEquipmentCount = sheetForm.watch("elevatorUnityIds")?.length ?? 0;
  const selectedDuration = sheetForm.watch("estimatedDurationMins") ?? 0;

  const days = useMemo(
    () => Array.from({ length: Math.max(config.totalDays, 1) }, (_, i) => i + 1),
    [config.totalDays]
  );

  const dayLoads = useMemo(() => {
    // La carga se cuenta por visita: cada grupo suma su duración una sola vez.
    const map = new Map<number, number>();
    for (const route of routes) {
      const total = groupStops(route.stops).reduce(
        (acc, g) =>
          acc + (g.stops[0]?.estimatedDurationMins || ROUTE_DEFAULTS.defaultStopDurationMins),
        0
      );
      map.set(route.businessDayNumber, (map.get(route.businessDayNumber) ?? 0) + total);
    }
    return map;
  }, [routes]);

  const dayCapacity = useMemo(() => {
    const map = new Map<number, { maxMinutes: number; isSaturday: boolean; date: string | null }>();
    for (const day of days) {
      map.set(
        day,
        resolveDayCapacity(generateMonthInput, day, {
          includeSaturdays: config.includeSaturdays,
          saturdayMaxHours: config.saturdayMaxHours,
        })
      );
    }
    return map;
  }, [days, generateMonthInput, config.includeSaturdays, config.saturdayMaxHours]);

  const activeSheetCapacity = dayCapacity.get(activeSheetDay);
  const activeSheetLoad = dayLoads.get(activeSheetDay) ?? 0;
  const activeSheetProjected = activeSheetLoad + selectedDuration;
  const activeSheetOverLimit = activeSheetCapacity
    ? activeSheetProjected > activeSheetCapacity.maxMinutes
    : false;

  async function reloadRoutes() {
    if (!technicianId) {
      setRoutes([]);
      return;
    }
    const [r, c] = await Promise.all([getPreventiveRoutes(technicianId), getRouteConfig(technicianId)]);
    setRoutes(r);
    setConfig(c);
  }

  function handleTechnicianChange(value: string) {
    const id = value || "";
    setTechnicianId(id);
    startTransition(async () => {
      if (!id) {
        setRoutes([]);
        return;
      }
      const [r, c] = await Promise.all([getPreventiveRoutes(id), getRouteConfig(id)]);
      setRoutes(r);
      setConfig(c);
    });
  }

  function handleAddStop(day: number) {
    setActiveSheetDay(day);
    sheetForm.reset({
      contractId: "",
      plannedTime: "09:00",
      estimatedDurationMins: config.defaultStopDurationMins,
      elevatorUnityIds: [],
    });
    setIsSheetOpen(true);
  }

  function handleSheetSubmit(values: RouteStopSheetValues) {
    startTransition(async () => {
      const res = await createRouteStops({
        technicianId,
        businessDayNumber: activeSheetDay,
        plannedTime: values.plannedTime,
        estimatedDurationMins: values.estimatedDurationMins,
        contractId: values.contractId,
        elevatorUnityIds: values.elevatorUnityIds,
      });
      if (res.success) {
        toast.success("Paradas guardadas", { description: res.message });
        setIsSheetOpen(false);
        await reloadRoutes();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleConfigSubmit(values: {
    totalDays: number;
    maxDays?: number;
    includeSaturdays: boolean;
    saturdayMaxHours: number;
    defaultStopDurationMins: number;
  }) {
    startTransition(async () => {
      const res = await updateRouteConfig(technicianId, {
        ...values,
        maxDays: config.canEditMaxDays ? values.maxDays : undefined,
      });
      if (res.success) {
        toast.success("Configuración guardada", { description: res.message });
        setIsConfigOpen(false);
        await reloadRoutes();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleResetConfig() {
    startTransition(async () => {
      const res = await resetRouteConfig(technicianId);
      if (res.success) {
        toast.success("Configuración restablecida", { description: res.message });
        setIsConfigOpen(false);
        await reloadRoutes();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleSaveEdit() {
    if (!editGroup) return;
    const ids = editGroup.stops.map((s) => s.id);
    startTransition(async () => {
      const timeRes = await updateRouteStopsTime(ids, timeInput);
      if (!timeRes.success) {
        toast.error("Error", { description: timeRes.error });
        return;
      }
      const durationRes = await updateRouteStopDuration(ids, Number(durationInput));
      if (!durationRes.success) {
        toast.error("Error", { description: durationRes.error });
        return;
      }
      toast.success("Visita actualizada", {
        description: `${timeRes.message} · ${durationRes.message}`,
      });
      setEditGroup(null);
      await reloadRoutes();
    });
  }

  function handleMoveDay() {
    if (!moveGroup) return;
    const day = Number(moveDayInput);
    if (!Number.isInteger(day) || day < 1 || day > config.totalDays) return;
    startTransition(async () => {
      const res = await moveRouteStops(
        moveGroup.stops.map((s) => s.id),
        technicianId,
        day
      );
      if (res.success) {
        toast.success("Paradas movidas", { description: res.message });
        setMoveGroup(null);
        await reloadRoutes();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleDeleteGroup() {
    if (!deleteGroup) return;
    startTransition(async () => {
      const res = await deleteRouteStops(deleteGroup.stops.map((s) => s.id));
      if (res.success) {
        toast.success("Paradas eliminadas", { description: res.message });
        setDeleteGroup(null);
        await reloadRoutes();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleGenerate() {
    startTransition(async () => {
      const res = await generateMonth(technicianId, generateMonthInput);
      if (res.error) {
        toast.error("Error", { description: res.error });
        return;
      }
      setGenerationResult(res);
      if (res.errors.length > 0) {
        toast.warning("Generación completada con errores", {
          description: `${res.created} visitas creadas · ${res.errors.length} con error`,
        });
      } else {
        toast.success("OTs generadas", {
          description: `${res.created} visitas creadas · ${res.skipped} equipos omitidos`,
        });
      }
      await reloadRoutes();
    });
  }

  function openGenerateDialog() {
    setGenerationResult(null);
    setGenerateMonthInput(nextMonthLabel());
    setIsGenerateOpen(true);
  }

  if (technicians.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No hay técnicos registrados. Crea un usuario con rol de técnico.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabecera: breadcrumbs + filtros */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <nav className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
            <span>Operaciones</span>
            <ChevronRight className="size-3" />
            <span className="text-foreground font-medium">
              Plantillas de Rutas Preventivas
            </span>
          </nav>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Zap className="size-5 text-[#0066CC]" />
            Rutas Preventivas
          </h1>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {config.totalDays} días hábiles ·{" "}
            {config.includeSaturdays
              ? `sábados máx. ${config.saturdayMaxHours}h`
              : "sin sábados"}{" "}
            · duración por defecto {formatDuration(config.defaultStopDurationMins)}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              Técnico
            </Label>
            <Select
              value={technicianId}
              onValueChange={(v) => handleTechnicianChange(v ?? "")}
            >
              <SelectTrigger className="w-full min-w-[220px] bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC] sm:w-[260px]">
                <SelectValue placeholder="Selecciona un técnico">
                  {technicians.find((t) => t.id === technicianId)?.fullName ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsConfigOpen(true)}
            disabled={!technicianId || isPending}
            size="sm"
            className="h-9 text-xs font-semibold gap-2 border-border shrink-0"
          >
            <Settings2 className="size-3.5" />
            Configurar días
          </Button>
          <Button
            type="button"
            onClick={openGenerateDialog}
            disabled={!technicianId || isPending}
            size="sm"
            className="h-9 bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs gap-2 shadow-xs shrink-0"
            title="Crea las órdenes de trabajo preventivas del mes seleccionado a partir de esta plantilla"
          >
            <CalendarCheck className="size-3.5" />
            Generar OTs del mes
          </Button>
        </div>
      </div>

      {!technicianId ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Selecciona un técnico para ver su tablero de rutas preventivas.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          {/* Tablero de días hábiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5">
            {days.map((day) => {
              const route = routes.find((r) => r.businessDayNumber === day);
              const stops = route?.stops ?? [];
              const groups = groupStops(stops);
              const capacity = dayCapacity.get(day);
              const usedMinutes = dayLoads.get(day) ?? 0;
              const maxMinutes = capacity?.maxMinutes ?? 480;
              const pct = Math.min(100, Math.round((usedMinutes / maxMinutes) * 100));
              const isOver = usedMinutes > maxMinutes;

              return (
                <div
                  key={day}
                  className="flex min-h-[180px] flex-col rounded-lg border border-border bg-muted/40 dark:bg-[#0e0e11]"
                >
                  {/* Header de columna */}
                  <div className="flex items-start justify-between gap-1 border-b border-border px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-foreground leading-tight flex items-center gap-1">
                        Día {day}
                        {capacity?.isSaturday && (
                          <Badge
                            variant="secondary"
                            className="px-1 py-0 text-[9px] font-semibold"
                          >
                            Sáb
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight">
                        {capacity?.date ?? "—"} ·{" "}
                        {stops.length === 0
                          ? "Sin paradas"
                          : `${stops.length} ${stops.length === 1 ? "equipo" : "equipos"}`}
                      </div>
                      <div className="mt-1.5 space-y-1">
                        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                          <span>
                            {formatDuration(usedMinutes)} / {formatDuration(maxMinutes)}
                          </span>
                          <span className={isOver ? "text-red-600 font-semibold" : ""}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-border">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isOver
                                ? "bg-red-500"
                                : pct > 80
                                  ? "bg-amber-500"
                                  : "bg-[#0066CC]"
                            }`}
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleAddStop(day)}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted"
                      title={`Agregar parada al Día ${day}`}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>

                  {/* Cuerpo de columna */}
                  <div className="flex flex-1 flex-col gap-2 p-2 min-h-[140px]">
                    {groups.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[10px] text-muted-foreground/70">
                        + Agregar parada
                      </div>
                    ) : (
                      groups.map((g) => {
                        const currentDay = routes.find(
                          (r) => r.id === g.stops[0].routeId
                        )?.businessDayNumber;
                        const groupMinutes =
                          g.stops[0]?.estimatedDurationMins ??
                          ROUTE_DEFAULTS.defaultStopDurationMins;
                        const generatedForMonth = g.stops.filter(
                          (s) => s.generatedMonth === generateMonthInput
                        ).length;
                        const lastGeneratedMonth = g.stops
                          .map((s) => s.generatedMonth)
                          .filter(Boolean)
                          .sort()
                          .pop();
                        const hasInactiveContract = g.stops.some(isContractInactive);
                        const generatedOtIds = [
                          ...new Set(
                            g.stops
                              .filter((s) => s.generatedMonth === generateMonthInput)
                              .map((s) => s.generatedWorkOrderId)
                              .filter((x): x is string => x !== null)
                          ),
                        ];
                        const isPartial = generatedForMonth > 0 && generatedForMonth < g.stops.length;
                        const isInconsistent = isPartial || generatedOtIds.length > 1;

                        return (
                          <div
                            key={g.key}
                            role="button"
                            tabIndex={0}
                            onClick={() => setDetailGroup(g)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setDetailGroup(g);
                              }
                            }}
                            className="group relative cursor-pointer rounded-lg border border-border bg-card p-2.5 shadow-xs transition-colors hover:border-[#0066CC]/40 hover:bg-muted/60"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                <Clock className="size-2.5" />
                                {formatTime(g.plannedTime)}
                              </span>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      className="text-muted-foreground hover:text-foreground hover:bg-muted"
                                      title="Opciones de visita"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  }
                                >
                                  <MoreHorizontal className="size-3.5" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-[180px]">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditGroup(g);
                                      setTimeInput(g.plannedTime);
                                      setDurationInput(
                                        String(
                                          g.stops[0]?.estimatedDurationMins ??
                                            ROUTE_DEFAULTS.defaultStopDurationMins
                                        )
                                      );
                                    }}
                                  >
                                    <Clock className="size-3.5" />
                                    Editar visita
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setMoveGroup(g);
                                      setMoveDayInput(String(currentDay ?? day));
                                    }}
                                  >
                                    <ArrowRight className="size-3.5" />
                                    Cambiar de día
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setDeleteGroup(g)}
                                  >
                                    <Trash2 className="size-3.5" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-foreground">
                              <MapPin className="size-3 shrink-0 text-[#0066CC]" />
                              <span className="truncate">{g.costCenterName}</span>
                            </div>

                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Users className="size-2.5" />
                              <span className="truncate">
                                {g.stops[0]?.clientName ?? "Sin cliente"}
                              </span>
                              <span>·</span>
                              <span>{g.stops.length} equipo{g.stops.length === 1 ? "" : "s"}</span>
                            </div>

                            <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <CalendarClock className="size-2.5" />
                              {formatDuration(groupMinutes)}
                            </div>

                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {g.stops.map((s) => (
                                <span
                                  key={s.id}
                                  className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                                    isContractInactive(s)
                                      ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                                      : "border-border bg-muted text-muted-foreground"
                                  }`}
                                  title={isContractInactive(s) ? "Contrato inactivo" : undefined}
                                >
                                  {s.internalCode}
                                </span>
                              ))}
                            </div>

                            <div className="mt-1.5">
                              {hasInactiveContract ? (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-red-300 px-1.5 py-0 text-[9px] font-semibold text-red-600 dark:border-red-900 dark:text-red-400"
                                >
                                  <AlertTriangle className="size-2.5" />
                                  Contrato inactivo
                                </Badge>
                              ) : generatedForMonth === g.stops.length ? (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-emerald-300 px-1.5 py-0 text-[9px] font-semibold text-emerald-700 dark:border-emerald-900 dark:text-emerald-400"
                                >
                                  <CheckCircle2 className="size-2.5" />
                                  OT generada {shortMonth(generateMonthInput)}
                                </Badge>
                              ) : isInconsistent ? (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-amber-300 px-1.5 py-0 text-[9px] font-semibold text-amber-700 dark:border-amber-900 dark:text-amber-400"
                                >
                                  <AlertTriangle className="size-2.5" />
                                  Inconsistente ({generatedForMonth}/{g.stops.length})
                                </Badge>
                              ) : lastGeneratedMonth ? (
                                <Badge
                                  variant="outline"
                                  className="gap-1 border-amber-300 px-1.5 py-0 text-[9px] font-semibold text-amber-700 dark:border-amber-900 dark:text-amber-400"
                                >
                                  <AlertTriangle className="size-2.5" />
                                  Última: {shortMonth(lastGeneratedMonth)}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="px-1.5 py-0 text-[9px] font-semibold text-muted-foreground"
                                >
                                  Pendiente de generar
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialog: Detalle de la visita agrupada */}
      <Dialog
        open={detailGroup !== null}
        onOpenChange={(o) => {
          if (!o) setDetailGroup(null);
        }}
      >
        <DialogContent className="bg-card border-border sm:max-w-[480px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <MapPin className="size-4 text-[#0066CC]" />
              {detailGroup?.costCenterName}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Visita del {detailGroup && formatTime(detailGroup.plannedTime)} ·{" "}
              {detailGroup?.stops.length} equipo
              {detailGroup && detailGroup.stops.length === 1 ? "" : "s"}
            </DialogDescription>
          </DialogHeader>

          {detailGroup && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-border px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Cliente
                  </div>
                  <div className="font-semibold">
                    {detailGroup.stops[0]?.clientName ?? "—"}
                  </div>
                </div>
                <div className="rounded-md border border-border px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Contrato
                  </div>
                  <div className="font-mono font-semibold">
                    {detailGroup.stops[0]?.contractNumber ?? "—"}
                  </div>
                </div>
                <div className="rounded-md border border-border px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Duración estimada
                  </div>
                  <div className="font-semibold">
                    {formatDuration(
                      detailGroup.stops[0]?.estimatedDurationMins ??
                        ROUTE_DEFAULTS.defaultStopDurationMins
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-border px-2.5 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Grupo
                  </div>
                  <div className="truncate font-mono text-[10px]">
                    {detailGroup.visitGroupId ?? "legacy"}
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-border">
                <div className="border-b border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Equipos de la visita
                </div>
                <div className="divide-y divide-border">
                  {detailGroup.stops.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold">
                          {s.internalCode}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {s.elevatorName}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {s.generatedMonth
                          ? `OT ${shortMonth(s.generatedMonth)}`
                          : "Sin generar"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const g = detailGroup;
                setDetailGroup(null);
                if (!g) return;
                setEditGroup(g);
                setTimeInput(g.plannedTime);
                setDurationInput(
                  String(
                    g.stops[0]?.estimatedDurationMins ??
                      ROUTE_DEFAULTS.defaultStopDurationMins
                  )
                );
              }}
            >
              Editar visita
            </Button>
            <Button type="button" onClick={() => setDetailGroup(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Configuración de días */}
      <Dialog open={isConfigOpen} onOpenChange={(o) => setIsConfigOpen(o)}>
        <DialogContent className="bg-card border-border sm:max-w-[440px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Settings2 className="size-4 text-[#0066CC]" />
              Configurar días hábiles
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define cuántos días hábiles tiene la plantilla y sus límites de carga.
            </DialogDescription>
          </DialogHeader>

          <Form {...configForm}>
            <form
              onSubmit={configForm.handleSubmit(handleConfigSubmit)}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={configForm.control}
                  name="totalDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">Total de días</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={config.maxDays}
                          className="h-8 text-xs"
                          {...field}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={configForm.control}
                  name="maxDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">
                        Máximo (admin)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          disabled={!config.canEditMaxDays}
                          className="h-8 text-xs"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={configForm.control}
                  name="saturdayMaxHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">
                        Horas máx. sábado
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={12}
                          step={0.5}
                          className="h-8 text-xs"
                          {...field}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={configForm.control}
                  name="defaultStopDurationMins"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold">
                        Duración por defecto (min)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={15}
                          max={600}
                          step={15}
                          className="h-8 text-xs"
                          {...field}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={configForm.control}
                name="includeSaturdays"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        id="includeSaturdays"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                    </FormControl>
                    <FormLabel
                      htmlFor="includeSaturdays"
                      className="text-xs font-normal cursor-pointer"
                    >
                      Incluir sábados como día hábil
                    </FormLabel>
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetConfig}
                  disabled={isPending}
                  className="text-xs border-border mr-auto gap-1.5"
                >
                  <RefreshCw className="size-3.5" />
                  Restablecer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConfigOpen(false)}
                  className="text-xs border-border"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
                >
                  {isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Sheet: Agregar parada */}
      <Sheet open={isSheetOpen} onOpenChange={(o) => setIsSheetOpen(o)}>
        <SheetContent className="w-full max-w-md bg-card border-border text-foreground">
          <SheetHeader>
            <SheetTitle className="text-base font-bold text-foreground">
              Agregar parada — Día {activeSheetDay}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Selecciona el edificio, los equipos a atender, la hora y la duración estimada.
            </SheetDescription>
          </SheetHeader>

          <Form {...sheetForm}>
            <form
              onSubmit={sheetForm.handleSubmit(handleSheetSubmit)}
              className="space-y-4"
            >
              <FormField
                control={sheetForm.control}
                name="contractId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">
                      Contrato / Edificio
                    </FormLabel>
                    <FormControl>
                      <SearchableSelect
                        items={contractOptions}
                        value={field.value ?? ""}
                        onValueChange={(v) => {
                          field.onChange(v);
                          sheetForm.setValue("elevatorUnityIds", []);
                        }}
                        getValue={(c) => c.id}
                        getLabel={(c) => `${c.costCenterName} — ${c.clientName}`}
                        getKeywords={(c) => c.contractNumber}
                        placeholder="Busca y selecciona un contrato preventivo"
                        searchPlaceholder="Buscar contrato, cliente o sede..."
                        emptyText="No hay contratos preventivos activos"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={sheetForm.control}
                name="elevatorUnityIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">Equipos</FormLabel>
                    <FormControl>
                      <div className="space-y-1.5">
                        {!selectedContract ? (
                          <div className="rounded-md border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
                            Primero selecciona un contrato o edificio.
                          </div>
                        ) : selectedContract.equipment.length === 0 ? (
                          <div className="rounded-md border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
                            Este contrato no tiene equipos vinculados.
                          </div>
                        ) : (
                          selectedContract.equipment.map((eq) => (
                            <div
                              key={eq.elevatorUnityId}
                              className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2"
                            >
                              <Checkbox
                                id={`eq-${eq.elevatorUnityId}`}
                                checked={field.value.includes(eq.elevatorUnityId)}
                                onCheckedChange={(checked) => {
                                  field.onChange(
                                    checked === true
                                      ? [...field.value, eq.elevatorUnityId]
                                      : field.value.filter((x) => x !== eq.elevatorUnityId)
                                  );
                                }}
                              />
                              <Label
                                htmlFor={`eq-${eq.elevatorUnityId}`}
                                className="text-xs font-normal cursor-pointer"
                              >
                                <span className="font-mono font-semibold text-foreground">
                                  {eq.internalCode}
                                </span>{" "}
                                — {eq.name}
                              </Label>
                            </div>
                          ))
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={sheetForm.control}
                name="plannedTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">
                      Hora Planificada
                    </FormLabel>
                    <FormControl>
                      <TimePicker
                        value={field.value ?? ""}
                        onChange={(v) => field.onChange(v)}
                        className="text-xs"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={sheetForm.control}
                name="estimatedDurationMins"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold">
                      Duración estimada (min)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={15}
                        max={600}
                        step={15}
                        className="h-8 text-xs"
                        {...field}
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {activeSheetCapacity && (
                <div
                  className={`rounded-md border px-3 py-2 text-[11px] ${
                    activeSheetOverLimit
                      ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                      : "border-border bg-muted/50 text-muted-foreground"
                  }`}
                >
                  Carga del día: {formatDuration(activeSheetLoad)} /{" "}
                  {formatDuration(activeSheetCapacity.maxMinutes)}
                  {activeSheetCapacity.isSaturday ? " (sábado)" : ""} · Proyectado:{" "}
                  {formatDuration(activeSheetProjected)}
                  {selectedEquipmentCount > 0
                    ? ` · ${selectedEquipmentCount} equipo${selectedEquipmentCount === 1 ? "" : "s"} en 1 visita`
                    : ""}
                </div>
              )}

              <SheetFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSheetOpen(false)}
                  className="text-xs border-border"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || activeSheetOverLimit}
                  className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
                >
                  {isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Guardar paradas
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* Dialog: Editar visita */}
      <Dialog open={!!editGroup} onOpenChange={(o) => !o && setEditGroup(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[360px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="size-4 text-[#0066CC]" />
              Editar visita
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Actualiza la hora planificada y la duración de {editGroup?.costCenterName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Hora planificada</Label>
              <TimePicker
                value={timeInput}
                onChange={(v) => setTimeInput(v)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold" htmlFor="groupDuration">
                Duración estimada (min)
              </Label>
              <Input
                id="groupDuration"
                type="number"
                min={15}
                max={600}
                step={15}
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditGroup(null)}
              className="text-xs border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveEdit}
              disabled={isPending}
              className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Cambiar de día */}
      <Dialog open={!!moveGroup} onOpenChange={(o) => !o && setMoveGroup(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[360px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <ArrowRight className="size-4 text-[#0066CC]" />
              Cambiar de día
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Mueve la visita de {moveGroup?.costCenterName} a otro día hábil.
            </DialogDescription>
          </DialogHeader>
          <Select value={moveDayInput} onValueChange={(v) => setMoveDayInput(v ?? "1")}>
            <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
              <SelectValue placeholder="Selecciona el día" />
            </SelectTrigger>
            <SelectContent>
              {days.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  Día {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMoveGroup(null)}
              className="text-xs border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleMoveDay}
              disabled={isPending}
              className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Mover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Eliminar paradas */}
      <Dialog open={!!deleteGroup} onOpenChange={(o) => !o && setDeleteGroup(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="size-4 text-red-600 dark:text-red-400" />
              Eliminar parada
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Eliminar la visita de{" "}
              <strong className="text-foreground">{deleteGroup?.costCenterName}</strong> a las{" "}
              {deleteGroup ? formatTime(deleteGroup.plannedTime) : ""}? Se quitarán{" "}
              {deleteGroup?.stops.length} equipos de la ruta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteGroup(null)}
              className="text-xs border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleDeleteGroup}
              disabled={isPending}
              className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold gap-2"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Generar OTs del mes */}
      <Dialog open={isGenerateOpen} onOpenChange={(o) => setIsGenerateOpen(o)}>
        <DialogContent className="bg-card border-border sm:max-w-[440px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Zap className="size-4 text-[#0066CC]" />
              Generar OTs del mes
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Se crearán las órdenes de trabajo preventivas de{" "}
              <strong className="text-foreground">
                {technicians.find((t) => t.id === technicianId)?.fullName}
              </strong>{" "}
              a partir de la plantilla. Las paradas ya generadas para ese mes se omiten.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold" htmlFor="generateMonth">
              Mes de generación
            </Label>
            <Input
              id="generateMonth"
              type="month"
              value={generateMonthInput}
              onChange={(e) => setGenerateMonthInput(e.target.value)}
              disabled={!!generationResult}
              className="h-8 text-xs"
            />
            {isValidMonthInput(generateMonthInput) && (
              <p className="text-[10px] text-muted-foreground">
                {formatMonthLabel(generateMonthInput)} · {config.totalDays} días hábiles
              </p>
            )}
          </div>

          {generationResult && (
            <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                {generationResult.errors.length > 0 ? (
                  <AlertTriangle className="size-3.5 text-amber-600" />
                ) : (
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                )}
                Resultado
              </div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <span>
                  Visitas / OTs:{" "}
                  <strong className="text-foreground">{generationResult.created}</strong>
                </span>
                <span>
                  Equipos omitidos:{" "}
                  <strong className="text-foreground">{generationResult.skipped}</strong>
                </span>
              </div>
              {generationResult.errors.length > 0 && (
                <ul className="max-h-32 space-y-1 overflow-y-auto text-[11px] text-red-600 dark:text-red-400">
                  {generationResult.errors.map((err) => (
                    <li key={`${err.visitGroupId ?? err.stopId}`}>
                      Día {err.businessDayNumber} · {err.costCenterName} ·{" "}
                      {err.equipmentCount} equipo{err.equipmentCount === 1 ? "" : "s"}:{" "}
                      {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsGenerateOpen(false)}
              className="text-xs border-border"
            >
              {generationResult ? "Cerrar" : "Cancelar"}
            </Button>
            {!generationResult && (
              <Button
                type="button"
                size="sm"
                onClick={handleGenerate}
                disabled={isPending || !isValidMonthInput(generateMonthInput)}
                className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                Generar OTs
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isValidMonthInput(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
