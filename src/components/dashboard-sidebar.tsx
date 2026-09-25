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
  Map,
  ReceiptText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function DashboardSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-300 select-none z-30 shadow-xs",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* HTL Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-3 overflow-hidden">
            {/* HTL Blue Icon Badge */}
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#0066CC] text-white font-extrabold shadow-sm">
              <span className="text-base tracking-tighter">H</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight text-foreground truncate">
                HTL Elevadores
              </span>
              <span className="text-[10px] text-muted-foreground truncate font-medium uppercase tracking-wider">
                Portal Privado
              </span>
            </div>
          </Link>
        )}

        {collapsed && (
          <Link href="/" className="mx-auto">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#0066CC] text-white font-extrabold shadow-sm">
              <span className="text-base tracking-tighter">H</span>
            </div>
          </Link>
        )}

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted-foreground hover:text-foreground hover:bg-muted ml-auto"
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronLeft className="size-3.5" />
          )}
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