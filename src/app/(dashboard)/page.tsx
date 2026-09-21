import Link from "next/link";
import { getBrands, getElevatorTypes, getModels } from "@/features/masters/actions";
import { getClients } from "@/features/clients/actions";
import { getEquipmentList } from "@/features/equipment/actions";
import { getCompletedWorkOrders } from "@/features/reports/actions";
import { getWorkOrders } from "@/features/work-orders/actions";
import { getContracts } from "@/features/contracts/actions";
import {
  Cpu,
  Layers,
  Database,
  ArrowRight,
  Building2,
  FileText,
  Wrench,
  FileSignature,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardHomePage() {
  const [brands, types, models, clients, equipment, informes, workOrders, contracts] =
    await Promise.all([
      getBrands(),
      getElevatorTypes(),
      getModels(),
      getClients(),
      getEquipmentList(),
      getCompletedWorkOrders(),
      getWorkOrders(),
      getContracts(),
    ]);

  const activeEquipment = equipment.filter((e) => e.status === "OPERATIVE").length;
  const activeContracts = contracts.filter((c) => c.status === "ACTIVE").length;
  const pendingWOs = workOrders.filter(
    (wo) => wo.status === "PENDING" || wo.status === "IN_PROGRESS"
  ).length;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 sm:p-8 shadow-xs">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-[#0066CC]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-16 -ml-10 w-56 h-56 bg-[#0066CC]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0066CC]/10 border border-[#0066CC]/20 text-xs font-semibold text-[#0066CC] dark:text-blue-400">
            <span className="size-2 rounded-full bg-[#0066CC] animate-pulse" />
            <span>Portal Privado HTL</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Bienvenido, Administrador
          </h1>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Centro de control técnico integral para la administración de clientes, centros de
            costo, equipos de elevación, contratos, órdenes de trabajo y generación de informes
            de mantenimiento.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link href="/clients">
              <Button size="sm" className="bg-[#0066CC] hover:bg-[#0055AA] text-white text-xs h-8 px-4 gap-2 font-semibold shadow-xs">
                <Building2 className="size-3.5" />
                Clientes y Sedes
                <ArrowRight className="size-3" />
              </Button>
            </Link>
            <Link href="/work-orders">
              <Button variant="outline" size="sm" className="text-xs h-8 px-4 gap-2 font-semibold border-[#0066CC]/30 text-[#0066CC] dark:text-blue-400 hover:bg-[#0066CC]/10">
                <Wrench className="size-3.5" />
                Ver OT pendientes ({pendingWOs})
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          {
            label: "Clientes",
            value: clients.length,
            desc: "Empresas y administraciones",
            icon: Building2,
          },
          {
            label: "Equipos Operativos",
            value: activeEquipment,
            desc: `${equipment.length} unidades en total`,
            icon: Cpu,
          },
          {
            label: "Contratos Activos",
            value: activeContracts,
            desc: `${contracts.length} contratos registrados`,
            icon: FileSignature,
          },
          {
            label: "OT Pendientes",
            value: pendingWOs,
            desc: "En curso o por iniciar",
            icon: Wrench,
          },
          {
            label: "Informes",
            value: informes.length,
            desc: "Órdenes de trabajo completadas",
            icon: FileText,
          },
          {
            label: "Catálogos Maestros",
            value: brands.length + types.length + models.length,
            desc: "Marcas, tipos y modelos",
            icon: Database,
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-border bg-card p-4 space-y-2 hover:border-[#0066CC]/40 transition-all shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">{metric.label}</span>
              <div className="size-7 rounded-lg bg-[#0066CC]/10 text-[#0066CC] dark:text-blue-400 flex items-center justify-center">
                <metric.icon className="size-3.5" />
              </div>
            </div>
            <div className="text-xl font-bold text-foreground font-mono">{metric.value}</div>
            <p className="text-[10px] text-muted-foreground">{metric.desc}</p>
          </div>
        ))}
      </div>

      {/* Modules Overview */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
          Módulos del Sistema
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/clients"
            className="group rounded-xl border border-border bg-card p-5 space-y-3 hover:border-[#0066CC]/50 transition-all shadow-xs"
          >
            <div className="size-9 rounded-lg bg-[#0066CC] text-white flex items-center justify-center shadow-xs">
              <Building2 className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground group-hover:text-[#0066CC] dark:group-hover:text-blue-400 transition-colors flex items-center justify-between">
                Clientes y Sedes
                <ArrowRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Directorio comercial y vista detallada de centros de costo asociados.
              </p>
            </div>
          </Link>

          <Link
            href="/equipment"
            className="group rounded-xl border border-border bg-card p-5 space-y-3 hover:border-[#0066CC]/50 transition-all shadow-xs"
          >
            <div className="size-9 rounded-lg bg-[#0066CC] text-white flex items-center justify-center shadow-xs">
              <Cpu className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground group-hover:text-[#0066CC] dark:group-hover:text-blue-400 transition-colors flex items-center justify-between">
                Equipos de Elevación
                <ArrowRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Inventario de transporte vertical con especificaciones y sedes.
              </p>
            </div>
          </Link>

          <Link
            href="/work-orders"
            className="group rounded-xl border border-border bg-card p-5 space-y-3 hover:border-[#0066CC]/50 transition-all shadow-xs"
          >
            <div className="size-9 rounded-lg bg-[#0066CC] text-white flex items-center justify-center shadow-xs">
              <Activity className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground group-hover:text-[#0066CC] dark:group-hover:text-blue-400 transition-colors flex items-center justify-between">
                Órdenes de Trabajo
                <ArrowRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Programación de mantenimientos y checklists de campo por equipo.
              </p>
            </div>
          </Link>

          <Link
            href="/reports"
            className="group rounded-xl border border-border bg-card p-5 space-y-3 hover:border-[#0066CC]/50 transition-all shadow-xs md:col-start-3"
          >
            <div className="size-9 rounded-lg bg-[#0066CC] text-white flex items-center justify-center shadow-xs">
              <FileText className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground group-hover:text-[#0066CC] dark:group-hover:text-blue-400 transition-colors flex items-center justify-between">
                Informes
                <ArrowRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Revisión de órdenes completadas: información, evidencias y
                observaciones.
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Secondary strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/contracts"
          className="group rounded-xl border border-border bg-card p-5 space-y-2 hover:border-[#0066CC]/50 transition-all shadow-xs flex items-start gap-3"
        >
          <div className="size-8 rounded-lg bg-muted text-[#0066CC] flex items-center justify-center">
            <Layers className="size-4" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground group-hover:text-[#0066CC] dark:group-hover:text-blue-400 transition-colors">
              Contratos y vinculación de equipos
            </h3>
            <p className="text-xs text-muted-foreground">
              Administra contratos de mantenimiento y sus unidades asociadas.
            </p>
          </div>
        </Link>
        <Link
          href="/masters"
          className="group rounded-xl border border-border bg-card p-5 space-y-2 hover:border-[#0066CC]/50 transition-all shadow-xs flex items-start gap-3"
        >
          <div className="size-8 rounded-lg bg-muted text-[#0066CC] flex items-center justify-center">
            <Database className="size-4" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground group-hover:text-[#0066CC] dark:group-hover:text-blue-400 transition-colors">
              Tablas Maestras
            </h3>
            <p className="text-xs text-muted-foreground">
              Catálogos de marcas, tipos de elevador y modelos.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}