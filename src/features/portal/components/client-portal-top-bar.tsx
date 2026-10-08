"use client";

import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

/**
 * Barra superior del portal del cliente: identidad de la sede a la izquierda y
 * utilidades (tema + salir) agrupadas a la derecha para evitar toques
 * accidentales en móvil. El cierre de sesión es un POST al route handler
 * `/portal/[costCenterId]/logout`, que borra la cookie y redirige al login.
 */
export function ClientPortalTopBar({
  costCenterId,
  costCenterName,
}: {
  costCenterId: string;
  costCenterName?: string | null;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 select-none items-center justify-between gap-2 border-b border-border bg-background px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[#0066CC]/10 text-[#0066CC]">
          <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
            <path d="M3 9.5 12 4l9 5.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{costCenterName ?? "Portal del cliente"}</p>
          <p className="hidden text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:block">Portal de mantenimiento · HTL Elevadores</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card/60 p-1 shadow-xs">
        <ThemeToggle />
        <form action={`/portal/${costCenterId}/logout`} method="post">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="h-9 gap-2 px-3 text-muted-foreground hover:text-foreground"
            title="Salir del portal"
          >
            <LogOut className="size-4" />
            <span className="hidden text-xs font-semibold sm:inline">Salir</span>
            <span className="sr-only sm:hidden">Salir</span>
          </Button>
        </form>
      </div>
    </header>
  );
}