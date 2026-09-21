import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPortalSessionCostCenterId } from "@/features/portal/server";
import { getPortalWorkOrderDocument } from "@/features/portal/queries";
import { WorkOrderDocument } from "@/features/portal/components/work-order-document";

export const dynamic = "force-dynamic";

interface WorkOrderDocumentPageProps {
  params: Promise<{ costCenterId: string; workOrderId: string }>;
}

export const metadata: Metadata = {
  title: "Informe del servicio",
};

export default async function WorkOrderDocumentPage({
  params,
}: WorkOrderDocumentPageProps) {
  const resolved = await params;
  const { costCenterId, workOrderId } = resolved;

  const session = await getPortalSessionCostCenterId();
  if (!session || session !== costCenterId) {
    redirect(`/portal/${costCenterId}/login`);
  }

  const data = await getPortalWorkOrderDocument(costCenterId, workOrderId);
  if (!data) {
    notFound();
  }

  const generatedAt = new Date().toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <WorkOrderDocument
      data={data}
      costCenterId={costCenterId}
      generatedAt={generatedAt}
    />
  );
}