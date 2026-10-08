import { notFound } from "next/navigation";
import { getQuotationById, getQuotationImages } from "@/features/quotations/actions";
import { QuotationDetailPage } from "@/features/quotations/components/quotation-detail-page";
import { requirePageAccess } from "@/features/auth/guard";

export const dynamic = "force-dynamic";

export default async function QuotationDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("quotations:read");
  const { id } = await params;
  const quotation = await getQuotationById(id);
  if (!quotation) notFound();
  const images = await getQuotationImages(id);
  return <QuotationDetailPage quotation={quotation} images={images} />;
}
