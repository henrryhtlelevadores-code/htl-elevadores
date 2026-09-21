import { redirect, notFound } from "next/navigation";
import { getPortalDashboardData } from "@/features/portal/queries";
import { getPortalSessionCostCenterId } from "@/features/portal/server";
import { CostCenterDashboard } from "@/features/portal/components/cost-center-dashboard";

export const dynamic = "force-dynamic";

export default async function PortalDashboardPage({
  params,
}: {
  params: Promise<{ costCenterId: string }>;
}) {
  const { costCenterId } = await params;

  const sessionCostCenterId = await getPortalSessionCostCenterId();
  if (sessionCostCenterId !== costCenterId) {
    redirect(`/portal/${costCenterId}/login`);
  }

  const data = await getPortalDashboardData(costCenterId);
  if (!data) {
    notFound();
  }

  return <CostCenterDashboard data={data} />;
}