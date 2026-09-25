"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";

const routeNames: Record<string, string> = {
  "/": "Inicio",
  "/clients": "Clientes y Centros de Costo",
  "/equipment": "Equipos de Elevación",
  "/contracts": "Contratos",
  "/work-orders": "Órdenes de Trabajo",
  "/safety": "Seguridad",
  "/users": "Personal y Usuarios",
  "/masters": "Tablas Maestras",
  "/reports": "Informes Técnicos",
  "/quotations": "Cotizaciones",
};

const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  SUPERVISOR: "Supervisor",
  "TECNICO DE CAMPO": "Técnico de Campo",
  SOPORTE: "Soporte",
};

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "HTL";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${second}`.toUpperCase();
}

export function DashboardTopbar({
  userName,
  roleName,
}: {
  userName: string;
  roleName: string;
}) {
  const pathname = usePathname();
  const currentTitle = routeNames[pathname] || "Operaciones";
  const roleLabel = ROLE_LABELS[roleName] ?? roleName;

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 select-none shadow-xs">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          HTL Elevadores
        </Link>
        <ChevronRight className="size-3 text-muted-foreground/60" />
        <span className="text-foreground font-semibold">{currentTitle}</span>
      </div>

      {/* Right Tools / User */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle (Claro / Oscuro) */}
        <ThemeToggle />

        {/* Cerrar sesión */}
        <LogoutButton />

        {/* User */}
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <div className="size-8 rounded-full bg-[#0066CC] text-white flex items-center justify-center text-xs font-bold shadow-xs">
            {initialsFromName(userName)}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-semibold text-foreground leading-tight max-w-[180px] truncate">
              {userName}
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              {roleLabel}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}