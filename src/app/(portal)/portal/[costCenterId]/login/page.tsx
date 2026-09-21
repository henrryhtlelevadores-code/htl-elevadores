import { redirect, notFound } from "next/navigation";
import { getPortalLoginInfo } from "@/features/portal/queries";
import { getPortalSessionCostCenterId } from "@/features/portal/server";
import { PortalLoginForm } from "@/features/portal/components/portal-login-form";

export const dynamic = "force-dynamic";

export default async function PortalLoginPage({
  params,
}: {
  params: Promise<{ costCenterId: string }>;
}) {
  const { costCenterId } = await params;
  const info = await getPortalLoginInfo(costCenterId);

  if (!info) {
    notFound();
  }

  const sessionCostCenterId = await getPortalSessionCostCenterId();
  if (sessionCostCenterId === costCenterId) {
    redirect(`/portal/${costCenterId}`);
  }

  return (
    <PortalLoginForm
      costCenterId={info.id}
      costCenterName={info.name}
      address={info.address}
      district={info.district}
      hasPassword={info.hasPassword}
    />
  );
}