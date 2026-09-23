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
  IconKey,
  IconKeyOff,
  IconLoader2,
  IconLink,
  IconShieldCheck,
  IconTrash,
  IconCopy,
  IconCheck,
  IconAlertTriangle,
  IconEye,
  IconEyeOff,
  IconId,
  IconWorld,
} from "@tabler/icons-react";
import { cn } from "cn";

interface CredentialsManagerProps {
  costCenter: CostCenter;
}

export function CredentialsManager({ costCenter }: CredentialsManagerProps) {
  const [hasPassword, setHasPassword] = useState<boolean>(Boolean(costCenter.passwordHash));
  const [isSetOpen, setIsSetOpen] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [copied, setCopied] = useState<null | "code" | "link">(null);
  const [isPending, startTransition] = useTransition();

  const portalUrl = `${window.location.origin}/portal/${costCenter.id}/login`;

  function handleCopy(key: "code" | "link") {
    navigator.clipboard
      .writeText(key === "code" ? costCenter.id : portalUrl)
      .then(() => {
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
        toast.success(key === "code" ? "Código copiado" : "Enlace copiado", {
          description:
            key === "code"
              ? "Comparte el código del edificio con el administrador."
              : "Comparte el enlace con el administrador del edificio.",
        });
      })
      .catch(() => {
        toast.error("No se pudo copiar", { description: "Inténtalo nuevamente." });
      });
  }

  function handleSetPassword() {
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
      const res = await setCostCenterPassword(costCenter.id, pin);
      if (res.success) {
        setHasPassword(true);
        setPin("");
        setConfirmPin("");
        setShowPin(false);
        setShowConfirmPin(false);
        setIsSetOpen(false);
        toast.success("Credencial creada", {
          description: `Se habilitó el acceso al portal para "${costCenter.name}".`,
        });
      } else {
        toast.error("Error al crear credencial", { description: res.error });
      }
    });
  }

  function handleClearPassword() {
    startTransition(async () => {
      const res = await clearCostCenterPassword(costCenter.id);
      if (res.success) {
        setHasPassword(false);
        setIsClearOpen(false);
        toast.success("Credencial eliminada", {
          description: `El acceso al portal de "${costCenter.name}" fue deshabilitado.`,
        });
      } else {
        toast.error("Error al eliminar credencial", { description: res.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Estado del portal */}
      <div
        className={cn(
          "rounded-xl border p-5 shadow-xs flex items-center gap-3",
          hasPassword
            ? "border-green-200 dark:border-green-500/20 bg-green-50/60 dark:bg-green-500/10"
            : "border-border bg-card"
        )}
      >
        <div
          className={cn(
            "size-10 rounded-lg flex items-center justify-center shrink-0",
            hasPassword ? "bg-green-100 dark:bg-green-500/20 text-green-600" : "bg-muted text-muted-foreground"
          )}
        >
          {hasPassword ? (
            <IconShieldCheck className="size-5" />
          ) : (
            <IconKeyOff className="size-5" />
          )}
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">
            {hasPassword ? "Acceso al portal habilitado" : "Sin contraseña configurada"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasPassword
              ? "El administrador de la sede puede ingresar al portal con esta credencial."
              : "Configura una contraseña para habilitar el acceso al portal."}
          </p>
        </div>
      </div>

      {/* Datos de acceso: código y enlace */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <IconLink className="size-3.5 text-[#0066CC]" />
          Datos de acceso al portal
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3.5 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <IconId className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground">Código del edificio</p>
              <p className="text-xs font-mono font-medium text-foreground truncate">{costCenter.id}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopy("code")}
            className="text-xs border-border gap-1.5 font-semibold shrink-0"
          >
            {copied === "code" ? (
              <IconCheck className="size-3.5 text-green-600" />
            ) : (
              <IconCopy className="size-3.5" />
            )}
            {copied === "code" ? "¡Copiado!" : "Copiar Código"}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3.5 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <IconWorld className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground">Enlace de acceso</p>
              <p className="text-xs font-mono font-medium text-foreground truncate">{portalUrl}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopy("link")}
            className="text-xs border-border gap-1.5 font-semibold shrink-0"
          >
            {copied === "link" ? (
              <IconCheck className="size-3.5 text-green-600" />
            ) : (
              <IconCopy className="size-3.5" />
            )}
            {copied === "link" ? "¡Copiado!" : "Copiar Enlace"}
          </Button>
        </div>
      </div>

      {/* Acciones de seguridad */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          size="sm"
          onClick={() => setIsSetOpen(true)}
          className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs gap-2 h-10 justify-center"
        >
          <IconKey className="size-4" />
          {hasPassword ? "Cambiar Contraseña" : "Configurar Contraseña"}
        </Button>

        {hasPassword && (
          <div className="rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5 p-2.5 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold text-red-700 dark:text-red-400 ml-1">
              Zona de riesgo
              <span className="block font-normal text-red-600/70 dark:text-red-400/70">
                Deshabilitará el acceso al portal.
              </span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsClearOpen(true)}
              className="text-xs border-red-200 dark:border-red-500/30 gap-1.5 font-semibold text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 shrink-0"
            >
              <IconTrash className="size-3.5" />
              Deshabilitar Acceso
            </Button>
          </div>
        )}
      </div>

      {/* Dialog: Crear / Cambiar contraseña */}
      <Dialog open={isSetOpen} onOpenChange={setIsSetOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[425px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <IconKey className="size-4 text-[#0066CC]" />
              {hasPassword ? "Cambiar Contraseña" : "Configurar Credencial"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define la contraseña de acceso al portal de{" "}
              <strong className="text-foreground">{costCenter.name}</strong>. Se
              almacena encriptada, nunca en texto plano.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold">Contraseña</label>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="bg-background border-border text-xs pr-9 focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title={showPin ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPin ? <IconEyeOff className="size-3.5" /> : <IconEye className="size-3.5" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold">Confirmar Contraseña</label>
              <div className="relative">
                <Input
                  type={showConfirmPin ? "text" : "password"}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="bg-background border-border text-xs pr-9 focus-visible:ring-1 focus-visible:ring-[#0066CC]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPin(!showConfirmPin)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  title={showConfirmPin ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showConfirmPin ? <IconEyeOff className="size-3.5" /> : <IconEye className="size-3.5" />}
                </button>
              </div>
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
              {isPending && <IconLoader2 className="size-3.5 animate-spin" />}
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
              <IconAlertTriangle className="size-4 text-red-600 dark:text-red-400" />
              Deshabilitar Acceso
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Estás seguro de eliminar la contraseña del portal de{" "}
              <strong className="text-foreground">{costCenter.name}</strong>? El
              acceso al portal quedará deshabilitado hasta que configures una nueva.
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
              {isPending && <IconLoader2 className="size-3.5 animate-spin" />}
              Deshabilitar Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}