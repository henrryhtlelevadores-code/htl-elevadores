import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPortalSessionCostCenterId } from "@/features/portal/server";
import { getPortalQuotation } from "@/features/portal/quotations";
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

  // Filtra por la sede de la sesión: una cotización ajena responde 404.
  const quotation = await getPortalQuotation(session, quotationId);
  if (!quotation) {
    notFound();
  }

  // Al navegador solo viaja lo necesario: el detalle completo incluye costos
  // y márgenes internos.
  const detail = {
    id: quotation.id,
    quotationNumber: quotation.quotationNumber,
    pdfUrl: quotation.pdfUrl ?? null,
    pdfGeneratedAt: quotation.pdfGeneratedAt ?? null,
  };

  return <PortalQuotationDocument detail={detail} costCenterId={costCenterId} />;
}