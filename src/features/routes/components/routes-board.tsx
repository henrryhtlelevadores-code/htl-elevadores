"use client";

import { useState, useTransition } from "react";
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
} from "lucide-react";

import {
  type TechnicianOption,
  type PreventiveContractOption,
  type PreventiveRouteWithStops,
  type RouteStopWithRelations,
  getPreventiveRoutes,
  createRouteStops,
  updateRouteStopsTime,
  moveRouteStops,
  deleteRouteStops,
  generateNextMonth,
} from "../actions";
import { routeStopSheetSchema, type RouteStopSheetValues } from "../schema";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface RoutesBoardProps {
  technicians: TechnicianOption[];
  contractOptions: PreventiveContractOption[];
  defaultRoutes: PreventiveRouteWithStops[];
}

type StopGroup = {
  plannedTime: string;
  costCenterId: string;
  costCenterName: string;
  stops: RouteStopWithRelations[];
};

const DAYS = Array.from({ length: 20 }, (_, i) => i + 1);

function formatTime(t: string): string {
  const [h, m] = t.split(":");
  const hh = Number(h);
  const suffix = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour12}:${m} ${suffix}`;
}

function groupStops(stops: RouteStopWithRelations[]): StopGroup[] {
  const map = new Map<string, StopGroup>();
  for (const s of stops) {
    const key = `${s.plannedTime}|${s.costCenterId}`;
    const g = map.get(key) ?? {
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
}: RoutesBoardProps) {
  const [technicianId, setTechnicianId] = useState(technicians[0]?.id ?? "");
  const [routes, setRoutes] = useState<PreventiveRouteWithStops[]>(
    technicians[0] ? defaultRoutes : []
  );
  const [isPending, startTransition] = useTransition();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeSheetDay, setActiveSheetDay] = useState(1);

  const [editGroup, setEditGroup] = useState<StopGroup | null>(null);
  const [timeInput, setTimeInput] = useState("");
  const [moveGroup, setMoveGroup] = useState<StopGroup | null>(null);
  const [moveDayInput, setMoveDayInput] = useState("1");
  const [deleteGroup, setDeleteGroup] = useState<StopGroup | null>(null);

  const [isGenerateOpen, setIsGenerateOpen] = useState(false);

  const sheetForm = useForm<RouteStopSheetValues>({
    resolver: zodResolver(routeStopSheetSchema),
    defaultValues: { contractId: "", plannedTime: "09:00", equipmentIds: [] },
  });

  const selectedContract = contractOptions.find(
    (c) => c.id === sheetForm.watch("contractId")
  );

  async function reloadRoutes() {
    if (!technicianId) {
      setRoutes([]);
      return;
    }
    const r = await getPreventiveRoutes(technicianId);
    setRoutes(r);
  }

  function handleTechnicianChange(value: string) {
    const id = value || "";
    setTechnicianId(id);
    startTransition(async () => {
      const r = id ? await getPreventiveRoutes(id) : [];
      setRoutes(r);
    });
  }

  function handleAddStop(day: number) {
    setActiveSheetDay(day);
    sheetForm.reset({ contractId: "", plannedTime: "09:00", equipmentIds: [] });
    setIsSheetOpen(true);
  }

  function handleSheetSubmit(values: RouteStopSheetValues) {
    startTransition(async () => {
      const res = await createRouteStops({
        technicianId,
        businessDayNumber: activeSheetDay,
        plannedTime: values.plannedTime,
        contractElevatorIds: values.equipmentIds,
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

  function handleSaveTime() {
    if (!editGroup) return;
    startTransition(async () => {
      const res = await updateRouteStopsTime(
        editGroup.stops.map((s) => s.id),
        timeInput
      );
      if (res.success) {
        toast.success("Hora actualizada", { description: res.message });
        setEditGroup(null);
        await reloadRoutes();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleMoveDay() {
    if (!moveGroup) return;
    const day = Number(moveDayInput);
    if (!Number.isInteger(day) || day < 1 || day > 20) return;
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
      const res = await generateNextMonth(technicianId);
      if (res.success) {
        toast.success("OTs generadas", { description: res.message });
      } else {
        toast.error("Error", { description: res.error });
      }
      setIsGenerateOpen(false);
      await reloadRoutes();
    });
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
            onClick={() => setIsGenerateOpen(true)}
            disabled={!technicianId || isPending}
            size="sm"
            className="h-9 bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs gap-2 shadow-xs shrink-0"
            title="Crea las órdenes de trabajo preventivas del próximo mes a partir de esta plantilla"
          >
            <Zap className="size-3.5" />
            Generar Mes Siguiente
          </Button>
        </div>
      </div>

      {!technicianId ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Selecciona un técnico para ver su tablero de rutas preventivas.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          {/* Tablero de días hábiles (cuadrícula 5x4) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5">
              {DAYS.map((day) => {
                const route = routes.find((r) => r.businessDayNumber === day);
                const stops = route?.stops ?? [];
                const groups = groupStops(stops);

                return (
                  <div
                    key={day}
                    className="flex min-h-[180px] flex-col rounded-lg border border-border bg-muted/40 dark:bg-[#0e0e11]"
                  >
                    {/* Header de columna */}
                    <div className="flex items-center justify-between gap-1 border-b border-border px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-foreground leading-tight">
                          Día {day}
                        </div>
                        <div className="text-[10px] text-muted-foreground leading-tight">
                          {stops.length === 0
                            ? "Sin paradas"
                            : `${stops.length} ${stops.length === 1 ? "equipo" : "equipos"}`}
                        </div>
                      </div>
                      <Button
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
                          return (
                            <div
                              key={`${g.plannedTime}-${g.costCenterId}`}
                              className="group relative rounded-lg border border-border bg-card p-2.5 shadow-xs transition-colors hover:border-[#0066CC]/40 hover:bg-muted/60"
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
                                        variant="ghost"
                                        size="icon-xs"
                                        className="text-muted-foreground hover:text-foreground hover:bg-muted"
                                        title="Opciones de parada"
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
                                      }}
                                    >
                                      <Clock className="size-3.5" />
                                      Editar hora
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setMoveGroup(g);
                                        setMoveDayInput(
                                          String(currentDay ?? day)
                                        );
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
                                <span className="truncate">
                                  {g.costCenterName}
                                </span>
                              </div>

                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {g.stops.map((s) => (
                                  <span
                                    key={s.id}
                                    className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground"
                                  >
                                    {s.internalCode}
                                  </span>
                                ))}
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

      {/* Sheet: Agregar parada */}
      <Sheet open={isSheetOpen} onOpenChange={(o) => setIsSheetOpen(o)}>
        <SheetContent className="w-full max-w-md bg-card border-border text-foreground">
          <SheetHeader>
            <SheetTitle className="text-base font-bold text-foreground">
              Agregar parada — Día {activeSheetDay}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Selecciona el edificio, los equipos a atender y la hora de la visita.
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
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v ?? "");
                          sheetForm.setValue("equipmentIds", []);
                        }}
                      >
                        <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
                          <SelectValue placeholder="Busca y selecciona un contrato preventivo">
                            {contractOptions.find(
                              (c) => c.id === field.value
                            )?.costCenterName ?? null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {contractOptions.length === 0 ? (
                            <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                              No hay contratos preventivos activos
                            </div>
                          ) : (
                            contractOptions.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.costCenterName} — {c.clientName}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={sheetForm.control}
                name="equipmentIds"
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
                              key={eq.id}
                              className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2"
                            >
                              <Checkbox
                                id={`eq-${eq.id}`}
                                checked={field.value.includes(eq.id)}
                                onCheckedChange={(checked) => {
                                  field.onChange(
                                    checked
                                      ? [...field.value, eq.id]
                                      : field.value.filter((x) => x !== eq.id)
                                  );
                                }}
                              />
                              <Label
                                htmlFor={`eq-${eq.id}`}
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
                      <Input
                        type="time"
                        {...field}
                        className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                  disabled={isPending}
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

      {/* Dialog: Editar hora */}
      <Dialog
        open={!!editGroup}
        onOpenChange={(o) => !o && setEditGroup(null)}
      >
        <DialogContent className="bg-card border-border sm:max-w-[360px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="size-4 text-[#0066CC]" />
              Editar hora
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Actualiza la hora planificada para {editGroup?.costCenterName}.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="time"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            className="bg-background border-border text-xs font-mono focus-visible:ring-1 focus-visible:ring-[#0066CC]"
          />
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
              onClick={handleSaveTime}
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
      <Dialog
        open={!!moveGroup}
        onOpenChange={(o) => !o && setMoveGroup(null)}
      >
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
              {DAYS.map((d) => (
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
      <Dialog
        open={!!deleteGroup}
        onOpenChange={(o) => !o && setDeleteGroup(null)}
      >
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="size-4 text-red-600 dark:text-red-400" />
              Eliminar parada
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Eliminar la visita de{" "}
              <strong className="text-foreground">
                {deleteGroup?.costCenterName}
              </strong>{" "}
              a las {deleteGroup ? formatTime(deleteGroup.plannedTime) : ""}? Se
              quitarán {deleteGroup?.stops.length} equipos de la ruta.
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

      {/* Dialog: Confirmar generación */}
      <Dialog
        open={isGenerateOpen}
        onOpenChange={(o) => setIsGenerateOpen(o)}
      >
        <DialogContent className="bg-card border-border sm:max-w-[420px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Zap className="size-4 text-[#0066CC]" />
              Generar Mes Siguiente
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Se crearán las órdenes de trabajo preventivas del próximo mes para{" "}
              <strong className="text-foreground">
                {technicians.find((t) => t.id === technicianId)?.fullName}
              </strong>
              , respetando la plantilla de rutas. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsGenerateOpen(false)}
              className="text-xs border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              disabled={isPending}
              className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Generar OTs
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}