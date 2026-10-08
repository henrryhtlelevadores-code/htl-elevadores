import { notFound } from "next/navigation";
import {
  getMaintenanceModuleById,
  getMaintenanceTasks,
  getActiveMaintenanceZones,
  type MaintenanceModuleWithCount,
} from "@/features/maintenance/actions";
import { ModuleTasksView } from "@/features/maintenance/components/module-tasks-view";
import { requirePageAccess } from "@/features/auth/guard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tareas del Módulo | HTL Elevadores",
};

export default async function ModuleTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("maintenance:read");
  const { id } = await params;

  const maintenanceModule = await getMaintenanceModuleById(id);
  if (!maintenanceModule) notFound();

  const tasks = await getMaintenanceTasks(maintenanceModule.id);
  const zones = await getActiveMaintenanceZones(maintenanceModule.elevatorTypeId);
  const moduleWithCount: MaintenanceModuleWithCount = {
    ...maintenanceModule,
    taskCount: tasks.length,
    contractCount: 0,
  };

  return <ModuleTasksView module={moduleWithCount} initialTasks={tasks} zones={zones} />;
}
