"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { type CostCenter } from "@/db";
import { setCostCenterPassword, clearCostCenterPassword } from "../actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  KeyRound,
  Loader2,
  Link2,
  ShieldCheck,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";

interface CredentialsManagerProps {
  costCenters: CostCenter[];
}

type HasPasswordMap = Record<string, boolean>;

export function CredentialsManager({ costCenters }: CredentialsManagerProps) {
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>("");
  const [hasPassword, setHasPassword] = useState<HasPasswordMap>(() => {
    const map: HasPasswordMap = {};
    for (const cc of costCenters) {
      map[cc.id] = Boolean(cc.passwordHash);
    }
    return map;
  });
  const [isSetOpen, setIsSetOpen] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selected = costCenters.find((cc) => cc.id === selectedCostCenterId);

  function handleSelect(value: string | null) {
    setSelectedCostCenterId(value ?? "");
    setIsSetOpen(false);
    setIsClearOpen(false);
  }

  function handleSetPassword() {
    if (!selected) return;
    if (pin.length < 6) {
      toast.error("Contraseña muy corta", {
        description: "La contraseña debe tener al menos 6 caracteres.",
      });
      return;
    }
    if (pin !== confirmPin) {
      toast.error("Las contraseñas no coinciden", {
        description: "Verifica que ambas contraseñas sean iguales.",
      });
      return;
    }

    startTransition(async () => {
      const res = await setCostCenterPassword(selected.id, pin);
      if (res.success) {
        setHasPassword((prev) => ({ ...prev, [selected.id]: true }));
        setPin("");
        setConfirmPin("");
        setIsSetOpen(false);
        toast.success("Credencial creada", {
          description: `Se habilitó el acceso al portal para "${selected.name}".`,
        });
      } else {
        toast.error("Error al crear credencial", { description: res.error });
      }
    });
  }

  function handleClearPassword() {
    if (!selected) return;
    startTransition(async () => {
      const res = await clearCostCenterPassword(selected.id);
      if (res.success) {
        setHasPassword((prev) => ({ ...prev, [selected.id]: false }));
        setIsClearOpen(false);
        toast.success("Credencial eliminada", {
          description: `El acceso al portal de "${selected.name}" fue deshabilitado.`,
        });
      } else {
        toast.error("Error al eliminar credencial", { description: res.error });
      }
    });
  }

  const portalUrl = selected
    ? `${window.location.origin}/portal/${selected.id}/login`
    : "";

  function handleCopyLink() {
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Enlace copiado", {
        description: "Comparte el enlace con el administrador del edificio.",
      });
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <label className="text-xs font-semibold text-foreground">
          Centro de Costo
        </label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">
          Selecciona la sede para crear o gestionar su contraseña de acceso al portal.
        </p>
        <div className="max-w-sm">
          <Select value={selectedCostCenterId} onValueChange={handleSelect}>
            <SelectTrigger className="w-full bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]">
              <SelectValue placeholder="Selecciona un centro de costo">
                {selected?.name ?? null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {costCenters.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>
                  {cc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedCostCenterId && selected ? (
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <KeyRound className="size-4 text-[#0066CC]" />
                {selected.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasPassword[selected.id] ? (
                  "Acceso al portal habilitado"
                ) : (
                  "Sin contraseña configurada"
                )}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${
                hasPassword[selected.id]
                  ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20"
                  : "text-muted-foreground bg-muted border-border"
              }`}
            >
              <ShieldCheck className="size-3.5" />
              {hasPassword[selected.id] ? "Configurada" : "Sin configurar"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => {
                setIsSetOpen(true);
                setIsClearOpen(false);
              }}
              className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs gap-2"
            >
              <KeyRound className="size-3.5" />
              {hasPassword[selected.id] ? "Cambiar Contraseña" : "Crear Contraseña"}
            </Button>

            {hasPassword[selected.id] && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsClearOpen(true)}
                className="text-xs border-border gap-2 font-semibold text-red-600 dark:text-red-400 hover:text-red-700"
              >
                <Trash2 className="size-3.5" />
                Eliminar Credencial
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              disabled={!hasPassword[selected.id]}
              className="text-xs border-border gap-2 font-semibold"
            >
              {copied ? (
                <Check className="size-3.5 text-green-600" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Enlace copiado" : "Copiar enlace del portal"}
            </Button>
          </div>

          {hasPassword[selected.id] && (
            <div className="pt-2 border-t border-border">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Link2 className="size-3" />
                Código del edificio:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {selected.id}
                </span>
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
          <KeyRound className="mx-auto size-6 text-muted-foreground/60" />
          <p className="mt-2 text-sm font-semibold text-foreground">
            {costCenters.length === 0
              ? "Este cliente aún no tiene centros de costo"
              : "Elige un centro de costo"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {costCenters.length === 0
              ? "Registra una sede en el tab Centros de Costo para poder asignar credenciales."
              : "Selecciona arriba la sede a la que quieres crear su contraseña de acceso al portal."}
          </p>
        </div>
      )}

      {/* Dialog: Crear / Cambiar contraseña */}
      <Dialog open={isSetOpen} onOpenChange={setIsSetOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <KeyRound className="size-4 text-[#0066CC]" />
              {hasPassword[selected?.id ?? ""] ? "Cambiar Contraseña" : "Crear Credencial"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define la contraseña de acceso al portal del cliente para{" "}
              <strong className="text-foreground">{selected?.name}</strong>. Se
              almacena encriptada, nunca en texto plano.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold">Contraseña</label>
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Confirmar Contraseña</label>
              <Input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="Repite la contraseña"
                className="bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-[#0066CC]"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSetOpen(false)}
              className="text-xs border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleSetPassword}
              className="text-xs bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold gap-2"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Guardar Credencial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Eliminar credencial */}
      <Dialog open={isClearOpen} onOpenChange={setIsClearOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[400px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              Eliminar Credencial
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Estás seguro de eliminar la contraseña del portal de{" "}
              <strong className="text-foreground">{selected?.name}</strong>? El
              acceso al portal quedará deshabilitado hasta que crees una nueva.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsClearOpen(false)}
              className="text-xs border-border"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleClearPassword}
              className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold gap-2"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Eliminar Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}