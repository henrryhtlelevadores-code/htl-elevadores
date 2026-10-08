"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/features/auth/permissions";
import {
  LayoutDashboard,
  Building2,
  Cpu,
  FileSignature,
  ClipboardList,
  ShieldCheck,
  Database,
  FileText,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
  Map,
  ReceiptText,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FortexLogo } from "@/components/fortex-logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navGroups = [
  {
    title: "Core",
    items: [
      { title: "Inicio", href: "/", icon: LayoutDashboard, permission: null },
      { title: "Clientes y Centros de Costo", href: "/clients", icon: Building2, permission: "clients:read" },
      { title: "Equipos", href: "/equipment", icon: Cpu, permission: "equipment:read" },
    ],
  },
  {
    title: "Operaciones y Ventas",
    items: [
      { title: "Rutas Preventivas", href: "/routes", icon: Map, permission: "routes:read" },
      { title: "Órdenes de Trabajo", href: "/work-orders", icon: ClipboardList, permission: "work_orders:panel:read" },
      { title: "Contratos", href: "/contracts", icon: FileSignature, permission: "contracts:read" },
      { title: "Cotizaciones", href: "/quotations", icon: FileText, permission: "quotations:read" },
      { title: "Facturas", href: "/invoices", icon: ReceiptText, permission: "invoices:read" },
    ],
  },
  {
    title: "Administración",
    items: [
      { title: "Mantenimiento", href: "/configuracion/mantenimiento/modulos", icon: Wrench, permission: "maintenance:read" },
      { title: "Informes", href: "/reports", icon: FileText, permission: "reports:read" },
      { title: "Personal y Usuarios", href: "/users", icon: Users, permission: "users:read" },
      { title: "Seguridad", href: "/safety", icon: ShieldCheck, permission: "safety:read" },
      { title: "Tablas Maestras", href: "/masters", icon: Database, permission: "masters:read" },
    ],
  },
];

export function DashboardSidebar({
  permissions,
  mobileOpen = false,
  onMobileClose,
}: {
  permissions: string[];
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  // Solo se muestran los módulos que el rol puede leer; el servidor vuelve a
  // comprobarlo en cada página y acción.
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.permission === null || hasPermission(permissions, item.permission)
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      className={cn(
        "relative select-none border-border bg-sidebar text-sidebar-foreground shadow-xs transition-transform duration-300",
        "fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(20rem,calc(100vw-3rem))] flex-col border-r",
        "md:relative md:z-30 md:h-dvh md:flex md:translate-x-0 md:transition-[width] md:duration-200 md:ease-in-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "md:w-16" : "md:w-64"
      )}
    >
      {/* Fortex Brand Header */}
      <div
        className={cn(
          "sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-sidebar",
          collapsed ? "px-2" : "px-4"
        )}
      >
        {!collapsed && (
          <Link
            href="/"
            className="flex min-w-0 items-center overflow-hidden"
            title="Fortex Digital Solutions"
          >
            <FortexLogo className="h-8" maxWidth={160} priority />
          </Link>
        )}

        {collapsed && (
          <Link
            href="/"
            className="flex items-center"
            title="Fortex Digital Solutions"
          >
            <FortexLogo maxWidth={44} />
          </Link>
        )}

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onMobileClose}
          className="ml-auto text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          title="Cerrar menú"
          aria-label="Cerrar menú"
        >
          <X className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-6 z-50 hidden size-6 rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-gray-100 hover:text-foreground md:inline-flex"
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
        </Button>
      </div>

      {/* Navigation Links */}
        <nav className="min-h-0 flex flex-1 flex-col overflow-y-auto p-2">
         {visibleGroups.map((group) => (
           <div key={group.title} className="space-y-1 [&+&]:mt-4">
             <div className={cn("px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-opacity duration-200", collapsed && "opacity-0")}>{group.title}</div>
             {group.items.map((item) => {
           const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

            return (
              <Tooltip key={`${item.href}-${collapsed ? "collapsed" : "expanded"}`}>
                <TooltipTrigger asChild>
                  <Link
                   href={item.href}
               className={cn(
                 "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800",
                 isActive
                    ? "bg-[#0066CC] text-white shadow-xs font-semibold hover:bg-[#0066CC]"
                   : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white",
                 collapsed && "justify-center px-2"
               )}
               onClick={onMobileClose}
                 >
               <Icon
                 className={cn(
                   "size-4 shrink-0 transition-colors",
                   isActive
                     ? "text-white"
                     : "text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white"
                 )}
               />
                <span className={cn("truncate transition-opacity duration-200", collapsed && "opacity-0")}>{item.title}</span>
              {isActive && (
                <div className="absolute right-2 size-1.5 rounded-full bg-white opacity-80" />
              )}
                  </Link>
                </TooltipTrigger>
                {collapsed ? (
                  <TooltipContent
                    side="right"
                    sideOffset={10}
                    className="bg-gray-900 text-white shadow-lg dark:border dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    {item.title}
                  </TooltipContent>
                ) : null}
              </Tooltip>
            );
             })}
           </div>
         ))}
      </nav>
    </aside>
  );
}
