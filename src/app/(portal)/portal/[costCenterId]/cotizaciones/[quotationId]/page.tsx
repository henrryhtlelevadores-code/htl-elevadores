import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPortalSessionCostCenterId } from "@/features/portal/server";
import { getQuotationById } from "@/features/quotations/actions";
import { PortalQuotationDocument } from "@/features/portal/components/quotation-document";

export const dynamic = "force-dynamic";

interface PortalQuotationPageProps {
  params: Promise<{ costCenterId: string; quotationId: string }>;
}

export const metadata: Metadata = {
  title: "Cotización",
};

export default async function PortalQuotationPage({ params }: PortalQuotationPageProps) {
  const resolved = await params;
  const { costCenterId, quotationId } = resolved;

  const session = await getPortalSessionCostCenterId();
  if (!session || session !== costCenterId) {
    redirect(`/portal/${costCenterId}/login`);
  }

  const detail = await getQuotationById(quotationId);
  if (!detail) {
    notFound();
  }

  return <PortalQuotationDocument detail={detail} costCenterId={costCenterId} />;
}