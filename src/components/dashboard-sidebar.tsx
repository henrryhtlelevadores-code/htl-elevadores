"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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

const navItems = [
  {
    title: "Inicio",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Clientes y Centros de Costo",
    href: "/clients",
    icon: Building2,
  },
  {
    title: "Equipos",
    href: "/equipment",
    icon: Cpu,
  },
  {
    title: "Contratos",
    href: "/contracts",
    icon: FileSignature,
  },
  {
    title: "Rutas Preventivas",
    href: "/routes",
    icon: Map,
  },
  {
    title: "Órdenes de Trabajo",
    href: "/work-orders",
    icon: ClipboardList,
  },
  {
    title: "Facturas",
    href: "/invoices",
    icon: ReceiptText,
  },
  {
    title: "Cotizaciones",
    href: "/quotations",
    icon: FileText,
  },
  {
    title: "Seguridad",
    href: "/safety",
    icon: ShieldCheck,
  },
  {
    title: "Personal y Usuarios",
    href: "/users",
    icon: Users,
  },
  {
    title: "Mantenimiento",
    href: "/configuracion/mantenimiento/modulos",
    icon: Wrench,
  },
  {
    title: "Tablas Maestras",
    href: "/masters",
    icon: Database,
  },
  {
    title: "Informes",
    href: "/reports",
    icon: FileText,
  },
];

export function DashboardSidebar({
  mobileOpen = false,
  onMobileClose,
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "select-none border-border bg-sidebar text-sidebar-foreground shadow-xs transition-transform duration-300",
        "fixed inset-y-0 left-0 z-50 flex h-dvh w-[min(20rem,calc(100vw-3rem))] flex-col border-r",
        "md:relative md:z-30 md:h-auto md:flex md:translate-x-0 md:transition-[width]",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "md:w-16" : "md:w-64"
      )}
    >
      {/* Fortex Brand Header */}
      <div
        className={cn(
          "flex h-16 items-center justify-between border-b border-border",
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
          className="ml-auto hidden text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex"
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
        </Button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
        <div
          className={cn(
            "px-2 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase",
            collapsed && "text-center"
          )}
        >
          {!collapsed ? "Gestión y Operaciones" : "•••"}
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all relative",
                isActive
                  ? "bg-[#0066CC] text-white shadow-xs font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.title : undefined}
              onClick={onMobileClose}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  isActive
                    ? "text-white"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!collapsed && <span className="truncate">{item.title}</span>}
              {isActive && (
                <div className="absolute right-2 size-1.5 rounded-full bg-white opacity-80" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
