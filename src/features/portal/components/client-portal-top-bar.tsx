"use client";

import { LogOut } from "lucide-react";
import { FortexLogo } from "@/components/fortex-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

/**
 * Barra superior del portal del cliente: marca a la izquierda y utilidades
 * (tema + salir) a la derecha. El cierre de sesión es un POST al route handler
 * `/portal/[costCenterId]/logout`, que borra la cookie y redirige al login.
 */
export function ClientPortalTopBar({ costCenterId }: { costCenterId: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 select-none items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      <FortexLogo className="h-7 sm:h-8" maxWidth={200} priority />

      <div className="flex items-center gap-1">
        <ThemeToggle />

        <form action={`/portal/${costCenterId}/logout`} method="post">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            title="Salir del portal"
          >
            <LogOut className="size-4" />
            <span className="ml-2 hidden sm:inline">Salir</span>
            <span className="sr-only sm:hidden">Salir</span>
          </Button>
        </form>
      </div>
    </header>
  );
}